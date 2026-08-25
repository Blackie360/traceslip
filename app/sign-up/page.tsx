import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { safeAuthCallback } from "@/lib/auth-callback"
export default async function SignUpPage({searchParams}:{searchParams:Promise<{callbackURL?:string|string[]}>}){const callbackURL=safeAuthCallback((await searchParams).callbackURL);const signInHref=`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`;return <AuthShell eyebrow="Create your record room" title="Create your account" copy="Use the exact email address that received the workspace invitation." footer={<>Already have an account? <Link href={signInHref} className="font-medium text-foreground underline underline-offset-4">Sign in</Link></>}><AuthForm mode="sign-up" callbackURL={callbackURL}/></AuthShell>}
