import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
export default function SignInPage(){return <AuthShell eyebrow="Welcome back" title="Sign in to your ledger" copy="Access your workspaces, source files, and receipt review queue." footer={<>New to TraceSlip? <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">Create an account</Link></>}><AuthForm mode="sign-in"/></AuthShell>}
