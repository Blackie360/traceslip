import Link from "next/link"
import { ArrowRight, Check, Mail } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const steps = [
  "Open the inbox for the email address you used to sign up.",
  "Find the message from TraceSlip and select Verify email.",
  "You’ll return to TraceSlip automatically to continue setup.",
]

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="One last check"
      title="Verify your email"
      copy="Your account is ready. Use the verification link we sent before signing in."
      footer={
        <>
          Used the wrong address?{" "}
          <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">
            Create the account again
          </Link>
        </>
      }
    >
      <div className="border border-border bg-background/70 p-5 paper-shadow sm:p-6">
        <div className="flex items-start gap-4 border-b border-dashed border-border pb-5">
          <div className="flex size-11 shrink-0 items-center justify-center bg-accent text-accent-foreground">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">Verification email sent</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Delivery can take a minute. Check your spam or promotions folder if it does not appear.
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-4" aria-label="Email verification steps">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 font-mono text-[10px] font-semibold text-accent">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <Link href="/sign-in" className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")}>
        Go to sign in
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Link>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Check className="size-3.5 text-accent" aria-hidden="true" />
        The verification link expires after 24 hours.
      </p>
    </AuthShell>
  )
}
