import { hashPassword } from "better-auth/crypto"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import nextEnv from "@next/env"
import { accounts, members, organizations, projects, receiptItems, receipts, users, workspaceSettings } from "@/db/schema"
const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())
const connectionString=process.env.DIRECT_DATABASE_URL??process.env.DATABASE_URL
if(!connectionString)throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required; seed has no fallback database")
const queryClient=postgres(connectionString,{max:1})
const db=drizzle(queryClient)
const userId="10000000-0000-4000-8000-000000000001",organizationId="10000000-0000-4000-8000-000000000002",projectId="10000000-0000-4000-8000-000000000003",receiptId="10000000-0000-4000-8000-000000000004"
const email=process.env.PLATFORM_ADMIN_EMAIL||"demo@traceslip.local"
try{const password=await hashPassword("TraceSlipDemo123!");await db.transaction(async tx=>{await tx.insert(users).values({id:userId,name:"TraceSlip Demo",email,emailVerified:true,role:process.env.PLATFORM_ADMIN_EMAIL?"platform_admin":"user"}).onConflictDoNothing();await tx.insert(accounts).values({id:crypto.randomUUID(),issuer:"local:credential",accountId:userId,providerId:"credential",userId,password}).onConflictDoNothing();await tx.insert(organizations).values({id:organizationId,name:"Kijani Studio",slug:"kijani-studio"}).onConflictDoNothing();await tx.insert(members).values({id:crypto.randomUUID(),organizationId,userId,role:"owner"}).onConflictDoNothing();await tx.insert(workspaceSettings).values({organizationId,locale:"en-KE",timezone:"Africa/Nairobi",defaultCurrency:"KES"}).onConflictDoNothing();await tx.insert(projects).values({id:projectId,organizationId,name:"Operations 2026",slug:"operations-2026",description:"Source-backed operating expenses",createdById:userId}).onConflictDoNothing();await tx.insert(receipts).values({id:receiptId,organizationId,projectId,archiveId:"TS-2026-000001",sourceNumber:"KM-78420",merchantName:"Kijani Market",merchantAddress:"Ngong Road, Nairobi",issuedAt:new Date("2026-08-24T08:42:00Z"),currency:"KES",subtotalMinor:215000,taxMinor:34400,totalMinor:249400,paymentMethod:"M-PESA",paymentReference:"QH42•••7M",createdById:userId,updatedById:userId}).onConflictDoNothing();await tx.insert(receiptItems).values([{receiptId,position:0,description:"Kenyan coffee beans",quantity:"2",unitPriceMinor:85000,totalMinor:170000},{receiptId,position:1,description:"Canvas market bag",quantity:"1",unitPriceMinor:45000,totalMinor:45000}]).onConflictDoNothing()});console.info(`Seeded ${email} with password TraceSlipDemo123!`)}finally{await queryClient.end()}
