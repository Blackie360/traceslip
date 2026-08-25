import { defineConfig } from "drizzle-kit"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")
loadEnvConfig(process.cwd())
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required")

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
})
