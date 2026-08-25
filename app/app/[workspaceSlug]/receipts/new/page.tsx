import { and, eq, inArray } from "drizzle-orm"
import { projectMembers, projects } from "@/db/schema"
import { ReceiptWorkbench } from "@/components/receipts/receipt-workbench"
import { requireWorkspace } from "@/lib/authorization"
import { db } from "@/lib/db"
export default async function NewReceiptPage({params}:{params:Promise<{workspaceSlug:string}>}){const{workspaceSlug}=await params;const access=await requireWorkspace(workspaceSlug);const available=["owner","admin"].includes(access.workspaceRole)?await db.select({id:projects.id,name:projects.name}).from(projects).where(eq(projects.organizationId,access.organizationId)).orderBy(projects.name):await db.select({id:projects.id,name:projects.name}).from(projects).innerJoin(projectMembers,and(eq(projectMembers.projectId,projects.id),eq(projectMembers.userId,access.session.user.id))).where(and(eq(projects.organizationId,access.organizationId),inArray(projectMembers.role,["manager","contributor"]))).orderBy(projects.name);return <ReceiptWorkbench projects={available}/>}
