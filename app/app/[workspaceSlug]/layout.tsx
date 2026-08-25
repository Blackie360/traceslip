import { AppShell } from "@/components/app-shell"
import { isImpersonating, requireWorkspace } from "@/lib/authorization"
export default async function WorkspaceLayout({children,params}:{children:React.ReactNode;params:Promise<{workspaceSlug:string}>}){const{workspaceSlug}=await params;const access=await requireWorkspace(workspaceSlug);return <AppShell workspace={{name:access.organizationName,slug:access.organizationSlug,role:access.workspaceRole}} user={access.session.user} impersonating={isImpersonating(access.session)}>{children}</AppShell>}
