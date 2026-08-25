import { NextResponse } from "next/server"
import { z } from "zod"
import { auditEvents, supportImpersonations } from "@/db/schema"
import { db } from "@/lib/db"
import { requirePlatformAdmin } from "@/lib/platform-authorization"
const schema=z.object({userId:z.string(),reason:z.string().trim().min(10).max(500)})
export async function POST(request:Request){try{const session=await requirePlatformAdmin();const input=schema.parse(await request.json());const expiresAt=new Date(Date.now()+15*60*1000);const [record]=await db.insert(supportImpersonations).values({adminUserId:session.user.id,targetUserId:input.userId,reason:input.reason,expiresAt}).returning({id:supportImpersonations.id});await db.insert(auditEvents).values({actorUserId:session.user.id,effectiveUserId:input.userId,action:"support.impersonation_started",entityType:"user",entityId:input.userId,reason:input.reason,metadata:{supportImpersonationId:record.id,expiresAt:expiresAt.toISOString(),readOnly:true}});return NextResponse.json({ok:true})}catch{return NextResponse.json({error:"A valid support reason is required"},{status:400})}}
