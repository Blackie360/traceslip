import { count, eq } from "drizzle-orm"
import { FolderKanban } from "lucide-react"
import { projects, receipts } from "@/db/schema"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireWorkspace } from "@/lib/authorization"
import { db } from "@/lib/db"
export default async function ProjectsPage({params}:{params:Promise<{workspaceSlug:string}>}){const{workspaceSlug}=await params;const access=await requireWorkspace(workspaceSlug);const rows=await db.select({id:projects.id,name:projects.name,description:projects.description,receiptCount:count(receipts.id)}).from(projects).leftJoin(receipts,eq(receipts.projectId,projects.id)).where(eq(projects.organizationId,access.organizationId)).groupBy(projects.id).orderBy(projects.name);return <><PageHeader eyebrow="Access boundaries" title="Projects" description="Workspace administrators see every project. Members only see projects where they are assigned."/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(project=><Card key={project.id}><CardHeader><div className="mb-5 grid size-10 place-items-center bg-secondary"><FolderKanban className="size-5 text-accent"/></div><CardTitle>{project.name}</CardTitle></CardHeader><CardContent><p className="min-h-10 text-sm text-muted-foreground">{project.description||"No project description"}</p><p className="mt-5 border-t pt-4 font-mono text-xs uppercase text-muted-foreground">{project.receiptCount} receipt{project.receiptCount===1?"":"s"}</p></CardContent></Card>)}</div></>}
