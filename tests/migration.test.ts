import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("database safeguards", () => {
  const migration = fs.readFileSync("drizzle/0000_lyrical_weapon_omega.sql", "utf8")
  const blobMigration = fs.readFileSync("drizzle/0001_marvelous_giant_man.sql", "utf8")
  const authMigration = fs.readFileSync("drizzle/0002_silky_may_parker.sql", "utf8")

  it("locks final records and requires a source", () => {
    expect(migration).toContain("receipts_guard_state")
    expect(migration).toContain("an original source attachment is required")
    expect(migration).toContain("final receipt content is immutable")
  })

  it("makes audit entries immutable and protects the last admin", () => {
    expect(migration).toContain("audit_events_immutable")
    expect(migration).toContain("member_guard_last_admin")
  })

  it("stores private sources and hashed upload tokens in Postgres", () => {
    expect(blobMigration).toContain('ADD COLUMN "content" "bytea"')
    expect(blobMigration).toContain('ADD COLUMN "upload_token_hash" text')
    expect(blobMigration).toContain('ADD COLUMN "upload_token_expires_at" timestamp with time zone')
  })

  it("backfills and constrains Better Auth account issuers", () => {
    expect(authMigration).toContain("local:credential")
    expect(authMigration).toContain("https://accounts.google.com")
    expect(authMigration).toContain('ALTER COLUMN "issuer" SET NOT NULL')
    expect(authMigration).toContain('CREATE UNIQUE INDEX "account_issuer_account_id_uidx"')
  })
})
