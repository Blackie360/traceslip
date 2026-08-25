import { migrate } from "drizzle-orm/postgres-js/migrator"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import nextEnv from "@next/env"
const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())
const url=process.env.DIRECT_DATABASE_URL??process.env.DATABASE_URL
if(!url)throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required")
const client=postgres(url,{max:1})
try{await migrate(drizzle(client),{migrationsFolder:"drizzle"})}finally{await client.end()}
