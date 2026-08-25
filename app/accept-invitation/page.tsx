import { AcceptInvitation } from "@/components/auth/accept-invitation"
import { AuthShell } from "@/components/auth/auth-shell"
export default async function AcceptInvitationPage({searchParams}:{searchParams:Promise<{id?:string|string[]}>}){const rawId=(await searchParams).id;const invitationId=Array.isArray(rawId)?rawId[0]:rawId;return <AuthShell eyebrow="Workspace invitation" title="Join the workspace" copy="Use the exact verified email address that received this invitation."><AcceptInvitation invitationId={invitationId}/></AuthShell>}
