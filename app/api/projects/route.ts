import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auditEvents, members, projects } from "@/db/schema"
import { assertMutableSession, getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"

const schema = z.object({ organizationId: z.string().min(1), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional() })
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)

export async function POST(request: Request){try{const session=await getRequestSession();if(!session)return NextResponse.json({error:"Resource not found"},{status:404});assertMutableSession(session);const input=schema.parse(await request.json());const [member]=await db.select({role:members.role}).from(members).where(and(eq(members.organizationId,input.organizationId),eq(members.userId,session.user.id))).limit(1);if(!member||!["owner","admin"].includes(member.role))return NextResponse.json({error:"Resource not found"},{status:404});const [project]=await db.insert(projects).values({organizationId:input.organizationId,name:input.name,slug:slugify(input.name),description:input.description,createdById:session.user.id}).returning();await db.insert(auditEvents).values({organizationId:input.organizationId,actorUserId:session.user.id,effectiveUserId:session.user.id,action:"project.created",entityType:"project",entityId:project.id,metadata:{name:project.name}});return NextResponse.json(project)}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:"Review the project details"},{status:400});console.error("project create failed",error);return NextResponse.json({error:"Unable to create project"},{status:400})}}
