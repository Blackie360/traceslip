import "server-only"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/db/schema"

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL is required; TraceSlip has no fallback database")

export const queryClient = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === "production" ? 5 : 2,
  idle_timeout: process.env.NODE_ENV === "production" ? 20 : 120,
  connect_timeout: 20,
})

export const db = drizzle(queryClient, { schema })
