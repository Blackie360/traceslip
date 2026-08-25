import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
export function StatusBadge({status}:{status:string}){return <Badge variant="outline" className={cn("w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",status==="final"&&"border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",status==="draft"&&"border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",status==="void"&&"border-red-600/20 bg-red-600/10 text-red-700 dark:text-red-300")}>{status}</Badge>}
