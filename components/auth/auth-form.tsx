"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const subscribeToHydration = () => () => undefined

export function AuthForm({ mode, callbackURL = "/app" }: { mode: "sign-in" | "sign-up" | "forgot" | "reset"; callbackURL?: string }) {
  const router = useRouter()
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "")
    try {
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email, password, callbackURL })
        if (result.error) throw new Error(result.error.message ?? "Unable to sign in")
        router.push(callbackURL); router.refresh()
      } else if (mode === "sign-up") {
        const result = await authClient.signUp.email({ name, email, password, callbackURL })
        if (result.error) throw new Error(result.error.message ?? "Unable to create your account")
        router.replace(`/verify-email?callbackURL=${encodeURIComponent(callbackURL)}`)
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
        if (result.error) throw new Error(result.error.message ?? "Unable to send reset email")
        toast.success("If the account exists, a reset link is on its way")
      } else {
        const token = new URLSearchParams(window.location.search).get("token") ?? ""
        const result = await authClient.resetPassword({ newPassword: password, token })
        if (result.error) throw new Error(result.error.message ?? "Unable to reset password")
        toast.success("Password reset. Sign in to continue."); router.push("/sign-in")
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong") } finally { setPending(false) }
  }

  const isSignUp = mode === "sign-up"
  const isForgot = mode === "forgot"
  const isReset = mode === "reset"
  return <form onSubmit={submit}><FieldGroup>
    {isSignUp && <Field><FieldLabel htmlFor="name">Full name</FieldLabel><Input id="name" name="name" autoComplete="name" required /></Field>}
    {!isReset && <Field><FieldLabel htmlFor="email">Email address</FieldLabel><Input id="email" name="email" type="email" autoComplete="email" required /></Field>}
    {!isForgot && <Field><div className="flex items-center justify-between"><FieldLabel htmlFor="password">Password</FieldLabel>{mode === "sign-in" && <Link href="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-4">Forgot password?</Link>}</div><Input id="password" name="password" type="password" minLength={10} autoComplete={isSignUp ? "new-password" : "current-password"} required />{isSignUp && <FieldDescription>At least 10 characters. Verify your email before signing in.</FieldDescription>}</Field>}
    {error && <FieldError>{error}</FieldError>}
    <Button type="submit" size="lg" disabled={pending || !hydrated}>{pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}{isSignUp ? "Create account" : isForgot ? "Send reset link" : isReset ? "Set new password" : "Sign in"}{!pending && <ArrowRight data-icon="inline-end" />}</Button>
    {(mode === "sign-in" || mode === "sign-up") && <Button type="button" variant="outline" disabled={!hydrated} onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}>Continue with Google</Button>}
  </FieldGroup></form>
}
