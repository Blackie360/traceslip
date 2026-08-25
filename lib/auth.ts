import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin, organization } from "better-auth/plugins"
import { adminAc, userAc } from "better-auth/plugins/admin/access"

import * as schema from "@/db/schema"
import { db } from "@/lib/db"
import { sendTransactionalEmail } from "@/lib/email"

const defaultAppUrl =
  process.env.NODE_ENV === "production" ? "https://blackielabs.com" : "http://localhost:3000"
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? defaultAppUrl
const authSchema = {
  ...schema,
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
  verification: schema.verifications,
  organization: schema.organizations,
  member: schema.members,
  invitation: schema.invitations,
}

export const auth = betterAuth({
  appName: "TraceSlip",
  baseURL: process.env.BETTER_AUTH_URL ?? appUrl,
  secret: process.env.BETTER_AUTH_SECRET ?? "development-only-change-this-traceslip-secret",
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your TraceSlip password",
        preview: "Reset your TraceSlip password",
        heading: "Reset your password",
        message: "Use the secure link below to choose a new password. The link expires in one hour.",
        actionLabel: "Choose a new password",
        actionUrl: url,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your TraceSlip email",
        preview: "Confirm the email for your TraceSlip account",
        heading: "Verify your email",
        message: "Confirm this email before accessing receipt workspaces or accepting an invitation.",
        actionLabel: "Verify email",
        actionUrl: url,
      })
    },
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
  },
  plugins: [
    organization({
      creatorRole: "owner",
      membershipLimit: 500,
      invitationExpiresIn: 60 * 60 * 72,
      requireEmailVerificationOnInvitation: true,
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async ({ id, email, organization: workspace, inviter }) => {
        const url = `${appUrl}/accept-invitation?id=${encodeURIComponent(id)}`
        await sendTransactionalEmail({
          to: email,
          subject: `Join ${workspace.name} on TraceSlip`,
          preview: `${inviter.user.name} invited you to ${workspace.name}`,
          heading: `Join ${workspace.name}`,
          message: `${inviter.user.name} invited you to collaborate on source-backed receipt records. Sign in with this exact verified email to accept.`,
          actionLabel: "Review invitation",
          actionUrl: url,
          footnote: "This invitation expires after 72 hours and only the invited verified email can accept it.",
        })
      },
    }),
    admin({
      adminRoles: ["platform_admin"],
      defaultRole: "user",
      roles: { platform_admin: adminAc, user: userAc },
      impersonationSessionDuration: 60 * 15,
      bannedUserMessage: "This account is suspended. Contact your TraceSlip administrator.",
    }),
    nextCookies(),
  ],
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
  },
})

export type AuthSession = typeof auth.$Infer.Session
