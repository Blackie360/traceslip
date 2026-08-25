"use client"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export function AcceptInvitation({ invitationId }: { invitationId?: string }) {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [pending, setPending] = useState(false)
  const callbackURL = invitationId ? `/accept-invitation?id=${encodeURIComponent(invitationId)}` : "/accept-invitation"
  const authQuery = `callbackURL=${encodeURIComponent(callbackURL)}`

  async function accept() {
    if (!invitationId || !session) return
    setPending(true)
    try {
      const resolutionResponse = await fetch(`/api/invitations/resolve?id=${encodeURIComponent(invitationId)}`, { cache: "no-store" })
      const resolution = await resolutionResponse.json()
      if (!resolutionResponse.ok) throw new Error(resolution.error ?? "Unable to check this invitation")

      if (!resolution.alreadyJoined) {
        const result = await authClient.organization.acceptInvitation({ invitationId: resolution.invitationId })
        if (result.error) {
          const message = result.error.status === 403
            ? "This invitation belongs to another email address, or this email is not verified."
            : result.error.message ?? "Unable to accept invitation"
          throw new Error(message)
        }
      }

      toast.success(resolution.alreadyJoined ? "Workspace already joined" : "Workspace joined")
      router.replace(`/app/${resolution.organizationSlug}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to join the workspace")
    } finally {
      setPending(false)
    }
  }

  async function useAnotherAccount() {
    await authClient.signOut()
    router.replace(`/sign-in?${authQuery}`)
    router.refresh()
  }

  if (!invitationId) return <p className="text-sm text-destructive">This invitation link is incomplete. Ask the workspace owner to resend it.</p>
  if (sessionPending) return <Button disabled><Loader2 className="animate-spin motion-reduce:animate-none" />Checking account…</Button>

  if (!session) {
    return (
      <div className="grid gap-3">
        <p className="text-sm leading-6 text-muted-foreground">Sign in or create an account with the email address that received the invitation. You will return here automatically.</p>
        <Link href={`/sign-in?${authQuery}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>Sign in to continue</Link>
        <Link href={`/sign-up?${authQuery}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>Create invited account</Link>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="border bg-background/70 p-4 text-sm">
        <p className="text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-medium">{session.user.email}</p>
      </div>
      <Button size="lg" onClick={accept} disabled={pending}>{pending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}{pending ? "Joining…" : "Accept invitation"}</Button>
      <Button variant="ghost" onClick={useAnotherAccount} disabled={pending}>Use another account</Button>
    </div>
  )
}
