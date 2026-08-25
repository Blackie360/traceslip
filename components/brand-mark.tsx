import Link from "next/link"
import { ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"

export function BrandMark({ href = "/", inverse = false, compact = false }: { href?: string; inverse?: boolean; compact?: boolean }) {
  return <Link href={href} className={cn("inline-flex items-center gap-2.5 font-semibold tracking-[-.04em]", inverse && "text-white")}><span className="grid size-8 place-items-center border border-current bg-accent text-accent-foreground"><ScanLine className="size-4" aria-hidden="true" /></span>{!compact && <span className="text-lg">TraceSlip</span>}</Link>
}
