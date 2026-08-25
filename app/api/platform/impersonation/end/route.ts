import { and, desc, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { auditEvents, supportImpersonations } from "@/db/schema"
import { getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
export async function POST(){const session=await getRequestSession();const adminId=session?.session.impersonatedBy;if(!session||!adminId)return NextResponse.json({error:"Resource not found"},{status:404});const [record]=await db.select().from(supportImpersonations).where(and(eq(supportImpersonations.adminUserId,adminId),eq(supportImpersonations.targetUserId,session.user.id),isNull(supportImpersonations.endedAt))).orderBy(desc(supportImpersonations.startedAt)).limit(1);if(record){await db.transaction(async tx=>{await tx.update(supportImpersonations).set({endedAt:new Date()}).where(eq(supportImpersonations.id,record.id));await tx.insert(auditEvents).values({actorUserId:adminId,effectiveUserId:session.user.id,action:"support.impersonation_ended",entityType:"user",entityId:session.user.id,reason:record.reason,metadata:{supportImpersonationId:record.id}})})}return NextResponse.json({ok:true})}
