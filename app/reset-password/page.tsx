import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
export default function ResetPage(){return <AuthShell eyebrow="Account recovery" title="Choose a new password" copy="Resetting your password revokes your other active sessions."><AuthForm mode="reset"/></AuthShell>}
