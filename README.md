# TraceSlip

**From paper slip to traceable record.**

TraceSlip is a multi-workspace receipt platform for capturing a scan or PDF, reviewing source-backed AI suggestions, and preserving a controlled digital copy. It does not issue merchant receipts or manufacture proof of purchase.

## What is implemented

- Mobile rear-camera input, drag-and-drop, JPEG/PNG/WebP/PDF support, rotation, private source preview, 10 MB limit, MIME/magic-byte checks, SHA-256 fingerprints, and duplicate warnings.
- OpenAI Responses API extraction using Structured Outputs and `store: false`, with `gpt-5.6-luna` as the default and an explicit `gpt-5.6-terra` enhanced retry.
- Evidence and confidence per suggestion, safe-selection threshold at `0.80`, monetary mismatch blocking, selective apply, undo, discard, manual correction, save, finalize, and void APIs.
- Better Auth verified email/password, Google OAuth, organization invitations, admin suspension/session controls, and 15-minute support impersonation.
- Owner/admin/member workspace roles and manager/contributor/viewer project roles with authoritative query/API checks.
- Neon Postgres through Drizzle for all application data, authentication data, one-time upload tokens, and private receipt binaries.
- Immutable audit records, draft version snapshots, database finalization locks, required original source, last-admin protection, and final/void immutability triggers.
- Ten receipt/invoice presets from one `ReceiptViewModel`, CSS print, 58/80 mm thermal PDF, and A4 PDF.
- Workspace overview, receipt register, projects, members, audit activity, settings, and a platform operations console.

The Kenya tax-reference preset only preserves source-visible seller/buyer PINs, ETR/SCU identifiers, tax data, and QR-presence metadata. It never generates KRA branding, identifiers, signatures, or QR codes and states: **“Digitized copy — not issued by eTIMS.”** See the [KRA invoice fields](https://www.kra.go.ke/component/kra_faq/faq/451) and [eTIMS verification guidance](https://www.kra.go.ke/helping-tax-payers/faqs/learn-about-etims).

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn `base-nova` with Base UI, Better Auth, Neon Postgres, Drizzle ORM, OpenAI, Resend, React Email, React PDF, Vitest, and Playwright.

## Local setup

Requirements: Node 22 or newer and pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`DATABASE_URL` is the sole runtime database for Better Auth and every TraceSlip application table. `DIRECT_DATABASE_URL` is used by migrations; it may point to the same Neon pooled endpoint when no separate direct endpoint is supplied. Runtime connections use prepared statements disabled for pooled serverless traffic.

TraceSlip fails fast when `DATABASE_URL` is absent; there is no SQLite, local Postgres, Supabase, or in-memory fallback.

The optional seed creates:

- Email: `demo@traceslip.local` (or `PLATFORM_ADMIN_EMAIL`)
- Password: `TraceSlipDemo123!`
- Workspace: `Kijani Studio`
- A project and one draft receipt

Do not run the demo seed against a production database.

## Receipt source storage in Neon

Receipt binaries are private `bytea` values in the Neon `attachments` table. TraceSlip creates a hashed ten-minute upload token after project authorization, accepts sequential 2 MB chunks, validates the final size, MIME signature, and SHA-256 fingerprint, and then clears the upload token. Files are limited to 10 MB and JPEG, PNG, WebP, or PDF.

Downloads stream from Neon only after a fresh receipt membership check. They use `private, no-store`, `nosniff`, sanitized filenames, and explicit MIME headers. Support impersonation records every raw-source access.

## Better Auth and Google OAuth

Generate a strong `BETTER_AUTH_SECRET`. For the Render production service, set both public application origins to the verified custom domain:

```text
BETTER_AUTH_URL=https://blackielabs.com
NEXT_PUBLIC_APP_URL=https://blackielabs.com
```

Add this exact authorized redirect URI to the Google OAuth web client:

```text
https://blackielabs.com/api/auth/callback/google
```

Local development continues to use `http://localhost:3000` and `http://localhost:3000/api/auth/callback/google`.

Email/password accounts require email verification. Workspace invitations can only be accepted by a signed-in account whose verified email exactly matches the invitation. The database trigger rejects removal or demotion of the last owner/admin.

To bootstrap a platform operator, set `PLATFORM_ADMIN_EMAIL` before `pnpm db:seed`, or update an already verified trusted user’s `user.role` to `platform_admin` through a controlled database administration session. The operations console is at `/app/platform`.

Support impersonation requires a reason, expires after 15 minutes, carries a persistent banner, and is read-only at both application APIs and the Better Auth POST boundary. Start, raw-source access, PDF export, and end events are audited.

## Resend

Set `RESEND_API_KEY` and `EMAIL_FROM="TraceSlip <no-reply@blackielabs.com>"`. The sender uses the verified `blackielabs.com` domain. TraceSlip uses React Email templates for verification, password reset, and workspace invitations. In local development with no key, delivery is skipped and only a non-sensitive status line is logged. Production treats missing email configuration as an error.

## OpenAI extraction

Set `OPENAI_API_KEY`. Optional overrides:

```text
OPENAI_RECEIPT_MODEL=gpt-5.6-luna
OPENAI_ENHANCED_MODEL=gpt-5.6-terra
```

Images are sent as `input_image`; PDFs are sent as `input_file`. Structured output includes normalized values, short source evidence, confidence, line items, fiscal metadata, and calculation warnings. Model reasoning is not requested or stored. TraceSlip persists model name, schema version, status, latency, token counts, safe errors, and the review payload.

AI suggestions never mutate a receipt. A user must apply them, save the draft, and explicitly finalize it. Missing values remain missing.

## Database and migrations

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Tracked SQL lives in `drizzle/`. The initial migration includes custom PostgreSQL triggers for audit immutability, final/void locking, line-item locking, original-source finalization, and last-admin protection. Review generated migrations before applying them and preserve these safeguards in future schema changes.

All timestamps use UTC `timestamptz`. Money is stored as integer minor units with an ISO currency code; quantity is a precise decimal; tax rates are basis points. Final totals are never combined across currencies.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Unit tests cover currency precision, calculations, confidence selection, fingerprints/file signatures, sanitized filenames, permission tables, all ten presets, and database safeguard SQL. Playwright runs public desktop/mobile smoke flows without credentials. Full authenticated capture, invitation, project-isolation, finalization, void, export, and support-impersonation suites require configured test identities.

An optional live AI smoke test should only run in a disposable workspace when `OPENAI_API_KEY` is present. The normal suite must mock AI and remain deterministic.

## Vercel deployment

1. Import the repository with the project root set to this directory.
2. Use Node 22 or newer and `pnpm build`.
3. Add every production environment variable from `.env.example` for Production and Preview as appropriate.
4. Use the Neon pooled connection for `DATABASE_URL`. Set `DIRECT_DATABASE_URL` to a direct Neon endpoint when available, or the same pooled endpoint when Neon is the only supplied connection.
5. Set the Google production callback and Better Auth application origins to the deployed HTTPS origin.
6. Run `pnpm db:migrate` in a controlled release step before promoting a build.
7. Verify verification email, invitation delivery, private upload/download, one real extraction, thermal/A4 PDF output, and the production support-view banner before launch.

Google, Resend, OpenAI, and Vercel credentials are required only for their respective features. Neon is the only database and receipt-storage service.

## Product boundaries

V1 does not provide billing, accounting integrations, KRA submission, vendor confirmation, public verification, or autonomous filing. A TraceSlip document is a digitized, source-backed copy, not a newly issued merchant document or independent proof of purchase. Formal trademark and domain clearance for “TraceSlip” remain launch requirements.
