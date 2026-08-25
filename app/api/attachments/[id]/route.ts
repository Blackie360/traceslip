import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { attachments, auditEvents } from "@/db/schema"
import { getRequestSession, isImpersonating } from "@/lib/authorization"
import { db } from "@/lib/db"
import { sanitizeFilename } from "@/lib/files"
import { getReceiptRecordForUser } from "@/lib/receipt-data"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const { id } = await params
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
    if (!attachment || attachment.status !== "ready" || !attachment.content) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    await getReceiptRecordForUser(attachment.receiptId, session.user.id)
    if (isImpersonating(session)) {
      await db.insert(auditEvents).values({
        organizationId: attachment.organizationId,
        actorUserId: session.session.impersonatedBy,
        effectiveUserId: session.user.id,
        action: "support.raw_source_accessed",
        entityType: "attachment",
        entityId: attachment.id,
        metadata: { receiptId: attachment.receiptId },
      })
    }
    const filename = sanitizeFilename(attachment.originalFilename, "receipt-source")
    return new NextResponse(new Uint8Array(attachment.content), {
      headers: {
        "content-type": attachment.mimeType,
        "content-length": String(attachment.byteSize),
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
}
