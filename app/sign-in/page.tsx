import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { safeAuthCallback } from "@/lib/auth-callback"
export default async function SignInPage({searchParams}:{searchParams:Promise<{callbackURL?:string|string[]}>}){const callbackURL=safeAuthCallback((await searchParams).callbackURL);const signUpHref=`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`;return <AuthShell eyebrow="Welcome back" title="Sign in to your ledger" copy="Access your workspaces, source files, and receipt review queue." footer={<>New to TraceSlip? <Link href={signUpHref} className="font-medium text-foreground underline underline-offset-4">Create an account</Link></>}><AuthForm mode="sign-in" callbackURL={callbackURL}/></AuthShell>}
