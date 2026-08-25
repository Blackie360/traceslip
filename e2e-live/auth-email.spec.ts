import crypto from "node:crypto"

import { expect, test } from "@playwright/test"
import postgres from "postgres"
import { Resend } from "resend"

const recipient = process.env.AUTH_E2E_EMAIL
const resendApiKey = process.env.RESEND_API_KEY
const databaseUrl = process.env.DATABASE_URL

if (!recipient) throw new Error("AUTH_E2E_EMAIL is required for the live authentication test")
if (!resendApiKey) throw new Error("RESEND_API_KEY is required for the live authentication test")
if (!databaseUrl) throw new Error("DATABASE_URL is required for the live authentication test")

function taggedEmail(email: string) {
  const separator = email.lastIndexOf("@")
  const local = email.slice(0, separator)
  const domain = email.slice(separator + 1)
  return `${local}+traceslip-e2e-${Date.now()}@${domain}`
}

function decodeHtmlAttribute(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#x3D;", "=").replaceAll("&quot;", '"')
}

test("email signup is delivered, verified, and signed in without mocks", async ({ page }) => {
  const email = taggedEmail(recipient)
  const password = `TraceSlip-${crypto.randomUUID()}-Aa1!`
  const resend = new Resend(resendApiKey)
  const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 10 })

  try {
    await page.goto("/sign-up")
    await page.getByLabel("Full name").fill("TraceSlip E2E")
    await page.getByLabel("Email address").fill(email)
    await page.getByLabel("Password").fill(password)
    const createAccount = page.getByRole("button", { name: /Create account/i })
    await expect(createAccount).toBeEnabled()
    await createAccount.click()

    await expect(page).toHaveURL(/\/verify-email$/)
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible()

    let emailId: string | undefined
    await expect
      .poll(
        async () => {
          const { data, error } = await resend.emails.list({ limit: 100 })
          if (error) throw new Error(error.message)
          const sent = data?.data.find(
            (item) => item.to.includes(email) && item.subject === "Verify your TraceSlip email"
          )
          emailId = sent?.id
          return sent?.last_event ?? null
        },
        { timeout: 30_000, message: "Resend should accept the verification email" }
      )
      .toMatch(/^(sent|delivered|opened|clicked)$/)

    if (!emailId) throw new Error("Resend accepted no matching verification email")
    const deliveredEmailId = emailId

    await expect
      .poll(
        async () => {
          const { data, error } = await resend.emails.get(deliveredEmailId)
          if (error) throw new Error(error.message)
          return data?.last_event ?? null
        },
        { timeout: 90_000, message: "The recipient mail server should accept the email" }
      )
      .toMatch(/^(delivered|opened|clicked)$/)

    const { data: sentEmail, error: sentEmailError } = await resend.emails.get(deliveredEmailId)
    if (sentEmailError) throw new Error(sentEmailError.message)
    const hrefs = Array.from(sentEmail?.html?.matchAll(/href=["']([^"']+)["']/g) ?? [], (match) =>
      decodeHtmlAttribute(match[1])
    )
    const verificationUrl = hrefs.find((href) => href.includes("/api/auth/verify-email"))
    if (!verificationUrl) throw new Error("Verification email did not contain a Better Auth verification URL")

    await page.goto(verificationUrl)
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole("heading", { name: "Name your record room" })).toBeVisible()

    const [user] = await sql<{ id: string; email_verified: boolean }[]>`
      select id, email_verified from "user" where email = ${email} limit 1
    `
    expect(user?.email_verified).toBe(true)

    const [account] = await sql<{ account_id: string; provider_id: string }[]>`
      select account_id, provider_id from account where user_id = ${user.id} limit 1
    `
    expect(account?.provider_id).toBe("credential")
    expect(account?.account_id).toBe(user.id)

    const [session] = await sql<{ user_id: string }[]>`
      select user_id from session where user_id = ${user.id} order by created_at desc limit 1
    `
    expect(session?.user_id).toBe(user.id)

    console.log(`Live auth verified: Resend delivered ${deliveredEmailId}; user ${user.id} reached onboarding.`)
  } finally {
    await sql.end({ timeout: 5 })
  }
})
