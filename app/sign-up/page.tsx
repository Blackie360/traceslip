import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
export default function SignUpPage(){return <AuthShell eyebrow="Create your record room" title="Start with one workspace" copy="Invite your team, organize receipts by project, and keep every source-backed decision visible." footer={<>Already have an account? <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">Sign in</Link></>}><AuthForm mode="sign-up"/></AuthShell>}
