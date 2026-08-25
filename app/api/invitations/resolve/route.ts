import { and, desc, eq, gt, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { invitations, members, organizations } from "@/db/schema"
import { getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
import { isSessionDatabaseError } from "@/lib/transient-database-error"

const querySchema = z.object({ id: z.string().uuid() })

export async function GET(request: Request) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Sign in to accept this invitation." }, { status: 401 })

    const input = querySchema.parse({ id: new URL(request.url).searchParams.get("id") })
    const [requested] = await db
      .select({
        id: invitations.id,
        organizationId: invitations.organizationId,
        email: invitations.email,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        organizationSlug: organizations.slug,
      })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .where(eq(invitations.id, input.id))
      .limit(1)

    if (!requested) return NextResponse.json({ error: "This invitation link is invalid." }, { status: 404 })
    if (requested.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ error: "This invitation belongs to another email address." }, { status: 403 })
    }
    if (!session.user.emailVerified) {
      return NextResponse.json({ error: "Verify your email before joining the workspace." }, { status: 403 })
    }

    const [membership] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.organizationId, requested.organizationId), eq(members.userId, session.user.id)))
      .limit(1)
    if (membership) {
      return NextResponse.json({ alreadyJoined: true, organizationSlug: requested.organizationSlug })
    }

    let invitationId = requested.id
    const now = new Date()
    if (requested.status !== "pending" || requested.expiresAt <= now) {
      const [replacement] = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(and(
          eq(invitations.organizationId, requested.organizationId),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, now),
          sql`lower(${invitations.email}) = ${session.user.email.toLowerCase()}`
        ))
        .orderBy(desc(invitations.createdAt))
        .limit(1)
      if (!replacement) {
        return NextResponse.json({ error: "This invitation is no longer active. Ask the workspace owner to send a new one." }, { status: 410 })
      }
      invitationId = replacement.id
    }

    return NextResponse.json({
      invitationId,
      organizationSlug: requested.organizationSlug,
      replaced: invitationId !== requested.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 })
    if (isSessionDatabaseError(error)) {
      return NextResponse.json({ error: "The database connection was interrupted. Try joining again." }, { status: 503 })
    }
    console.error("invitation resolution failed", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Unable to check this invitation." }, { status: 500 })
  }
}
