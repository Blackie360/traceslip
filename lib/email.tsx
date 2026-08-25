import "server-only"

import { Resend } from "resend"

import { TransactionalEmail } from "@/components/emails/transactional-email"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

type SendEmailInput = {
  to: string
  subject: string
  preview: string
  heading: string
  message: string
  actionLabel: string
  actionUrl: string
  footnote?: string
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[TraceSlip email disabled] ${input.subject} -> ${input.to}`)
      return
    }
    throw new Error("Transactional email is not configured")
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "TraceSlip <no-reply@blackielabs.com>",
    to: input.to,
    subject: input.subject,
    react: <TransactionalEmail {...input} />,
  })
  if (error) throw new Error(error.message)
}
