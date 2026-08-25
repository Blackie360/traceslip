import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auditEvents, organizations } from "@/db/schema"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/platform-authorization"
const schema=z.object({organizationId:z.string(),suspended:z.boolean(),reason:z.string().min(8).max(500)})
export async function POST(request:Request){try{const session=await requirePlatformAdmin();const input=schema.parse(await request.json());await db.transaction(async tx=>{await tx.update(organizations).set({suspendedAt:input.suspended?new Date():null,suspensionReason:input.suspended?input.reason:null}).where(eq(organizations.id,input.organizationId));await tx.insert(auditEvents).values({actorUserId:session.user.id,effectiveUserId:session.user.id,organizationId:input.organizationId,action:input.suspended?"platform.workspace_suspended":"platform.workspace_restored",entityType:"organization",entityId:input.organizationId,reason:input.reason})});return NextResponse.json({ok:true})}catch{return NextResponse.json({error:"Resource not found"},{status:404})}}
