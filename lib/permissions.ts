import type { ProjectRole, WorkspaceRole } from "@/lib/receipt-types"
export type Access={workspaceRole:WorkspaceRole;projectRole:ProjectRole|null}
export function canCreateReceipt(access:Access){return access.workspaceRole==="owner"||access.workspaceRole==="admin"||access.projectRole==="manager"||access.projectRole==="contributor"}
export function canManageProject(access:Access){return access.workspaceRole==="owner"||access.workspaceRole==="admin"||access.projectRole==="manager"}
export function canFinalizeReceipt(access:Access,receiptCreatorId:string,userId:string){return access.workspaceRole==="owner"||access.workspaceRole==="admin"||access.projectRole==="manager"||(access.projectRole==="contributor"&&receiptCreatorId===userId)}
export const canEditReceipt=canFinalizeReceipt
export function canVoidReceipt(access:Access){return access.workspaceRole==="owner"||access.workspaceRole==="admin"||access.projectRole==="manager"}
