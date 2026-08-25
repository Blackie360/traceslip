import { Suspense } from "react"
import { AcceptInvitation } from "@/components/auth/accept-invitation"
import { AuthShell } from "@/components/auth/auth-shell"
export default function AcceptInvitationPage(){return <AuthShell eyebrow="Workspace invitation" title="Join the workspace" copy="Sign in with the exact verified email that received the invitation, then accept below."><Suspense><AcceptInvitation/></Suspense></AuthShell>}
