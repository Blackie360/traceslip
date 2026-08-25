import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { members, organizations } from "@/db/schema"
import { requireSession } from "@/lib/authorization"
import { db } from "@/lib/db"
export default async function AppIndex(){const session=await requireSession();const [workspace]=await db.select({slug:organizations.slug}).from(members).innerJoin(organizations,eq(organizations.id,members.organizationId)).where(eq(members.userId,session.user.id)).limit(1);redirect(workspace?`/app/${workspace.slug}`:"/onboarding")}
