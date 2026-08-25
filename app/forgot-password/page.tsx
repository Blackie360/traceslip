import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
export default function ForgotPage(){return <AuthShell eyebrow="Account recovery" title="Reset your password" copy="We’ll send a one-hour reset link if an account matches this email."><AuthForm mode="forgot"/></AuthShell>}
