import nextEnv from "@next/env"
import postgres from "postgres"

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required")

const expectedTables = [
  "account", "ai_extraction_attempts", "attachments", "audit_events", "invitation",
  "member", "merchant_profiles", "organization", "project_members", "projects",
  "receipt_counters", "receipt_items", "receipt_versions", "receipts", "session",
  "support_impersonations", "user", "verification", "workspace_settings",
]
const expectedTriggers = [
  "audit_events_immutable",
  "member_guard_last_admin",
  "receipt_items_guard_final",
  "receipts_guard_state",
]

const client = postgres(url, { max: 1, prepare: false })
try {
  const tables = await client<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name = any(${expectedTables})
    order by table_name
  `
  const triggers = await client<{ trigger_name: string }[]>`
    select distinct trigger_name from information_schema.triggers
    where trigger_schema = 'public' and trigger_name = any(${expectedTriggers})
    order by trigger_name
  `
  const migrations = await client<{ count: number }[]>`
    select count(*)::int as count from drizzle.__drizzle_migrations
  `
  const missingTables = expectedTables.filter((name) => !tables.some((table) => table.table_name === name))
  const missingTriggers = expectedTriggers.filter((name) => !triggers.some((trigger) => trigger.trigger_name === name))
  const attachmentColumns = await client<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'attachments'
      and column_name = any(${["content", "upload_token_hash", "upload_token_expires_at"]})
  `
  const authIssuerColumns = await client<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'account'
      and column_name = 'issuer' and is_nullable = 'NO'
  `
  const authIssuerIndexes = await client<{ indexname: string }[]>`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'account'
      and indexname = 'account_issuer_account_id_uidx'
  `
  const receiptCategoryColumns = await client<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'receipts'
      and column_name = 'expense_category'
  `
  if (missingTables.length || missingTriggers.length || migrations[0]?.count !== 4 || attachmentColumns.length !== 3 || authIssuerColumns.length !== 1 || authIssuerIndexes.length !== 1 || receiptCategoryColumns.length !== 1) {
    throw new Error(`Database verification failed: missing tables=${missingTables.join(",") || "none"}; missing triggers=${missingTriggers.join(",") || "none"}; migrations=${migrations[0]?.count ?? 0}`)
  }
  console.info(`Database verified: ${tables.length} tables, ${triggers.length} integrity triggers, ${attachmentColumns.length} private-source columns, expense category, Better Auth issuer identity constraint, ${migrations[0].count} migrations.`)
} finally {
  await client.end()
}
