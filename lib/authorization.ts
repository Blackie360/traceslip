import "server-only"

import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { members, organizations, projectMembers, projects } from "@/db/schema"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import type { ProjectRole, WorkspaceRole } from "@/lib/receipt-types"
import { isSessionDatabaseError } from "@/lib/transient-database-error"
export { canCreateReceipt, canEditReceipt, canFinalizeReceipt, canManageProject, canVoidReceipt } from "@/lib/permissions"

export class AuthorizationError extends Error {
  status = 404
  constructor() {
    super("Resource not found")
  }
}

export async function getRequestSession() {
  const requestHeaders = await headers()
  try {
    return await auth.api.getSession({ headers: requestHeaders })
  } catch (error) {
    if (!isSessionDatabaseError(error)) throw error
    await new Promise((resolve) => setTimeout(resolve, 150))
    return auth.api.getSession({ headers: requestHeaders })
  }
}

export async function requireSession() {
  const session = await getRequestSession()
  if (!session) redirect("/sign-in")
  return session
}

export function isImpersonating(session: Awaited<ReturnType<typeof getRequestSession>>) {
  return Boolean(session?.session.impersonatedBy)
}

export function assertMutableSession(session: NonNullable<Awaited<ReturnType<typeof getRequestSession>>>) {
  if (isImpersonating(session)) throw new AuthorizationError()
}

export async function requireWorkspace(slug: string) {
  const session = await requireSession()
  const [access] = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      suspendedAt: organizations.suspendedAt,
      workspaceRole: members.role,
    })
    .from(organizations)
    .innerJoin(members, and(eq(members.organizationId, organizations.id), eq(members.userId, session.user.id)))
    .where(eq(organizations.slug, slug))
    .limit(1)

  if (!access || access.suspendedAt) notFound()
  return { ...access, workspaceRole: access.workspaceRole as WorkspaceRole, session }
}

export async function getProjectAccess(userId: string, projectId: string) {
  const [project] = await db
    .select({
      id: projects.id,
      organizationId: projects.organizationId,
      workspaceRole: members.role,
      projectRole: projectMembers.role,
    })
    .from(projects)
    .innerJoin(members, and(eq(members.organizationId, projects.organizationId), eq(members.userId, userId)))
    .leftJoin(projectMembers, and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, userId)))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) throw new AuthorizationError()
  const workspaceRole = project.workspaceRole as WorkspaceRole
  const projectRole = project.projectRole as ProjectRole | null
  if (workspaceRole === "member" && !projectRole) throw new AuthorizationError()
  return { ...project, workspaceRole, projectRole }
}
