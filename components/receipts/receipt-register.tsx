"use client"

import { ArrowRight, ReceiptText, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/money"

export type ReceiptRegisterRow = {
  id: string
  archiveId: string
  sourceNumber: string | null
  merchantName: string
  status: string
  totalMinor: number
  currency: string
  issuedDate: string | null
  projectName: string
}

export function ReceiptRegister({ rows, base }: { rows: ReceiptRegisterRow[]; base: string }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !normalized || [row.merchantName, row.archiveId, row.sourceNumber, row.projectName]
        .some((value) => value?.toLowerCase().includes(normalized))
      return matchesQuery
    })
  }, [query, rows])

  return (
    <section className="app-panel">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchant, reference, or project" aria-label="Search receipts" className="h-9 bg-background pl-9" />
        </div>
        <span className="hidden text-xs tabular-nums text-muted-foreground md:block">{filtered.length} of {rows.length}</span>
      </div>

      <div className="hidden grid-cols-[1.35fr_.8fr_.65fr_.7fr_auto] gap-4 app-table-head md:grid">
        <span>Record</span><span>Project</span><span>Date</span><span className="text-right">Amount</span><span className="w-16 text-right">Open</span>
      </div>
      {filtered.length ? filtered.map((row) => {
        const merchant = row.merchantName || "Merchant pending"
        return (
          <Link
            key={row.id}
            href={`${base}/receipts/${row.id}`}
            aria-label={`View ${merchant} receipt ${row.archiveId}`}
            className="group grid cursor-pointer gap-3 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/45 focus-visible:z-10 focus-visible:bg-muted/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring md:grid-cols-[1.35fr_.8fr_.65fr_.7fr_auto] md:items-center"
          >
            <div className="min-w-0"><p className="flex items-center gap-2 truncate font-medium transition-colors group-hover:text-accent"><span className="truncate">{merchant}</span>{row.status === "void" ? <Badge variant="destructive">Void</Badge> : null}</p><p className="truncate text-xs text-muted-foreground">{row.archiveId}{row.sourceNumber ? ` · ${row.sourceNumber}` : ""}</p></div>
            <span className="truncate text-sm text-muted-foreground">{row.projectName}</span>
            <span className="text-sm text-muted-foreground">{row.issuedDate ?? "—"}</span>
            <span className="text-sm font-medium tabular-nums md:text-right">{formatMoney(row.totalMinor, row.currency)}</span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-accent md:w-16 md:justify-end">View <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        )
      }) : (
        <div className="grid min-h-64 place-items-center p-8 text-center">
          <div><span className="mx-auto grid size-11 place-items-center rounded-full bg-muted"><ReceiptText className="size-5 text-muted-foreground" aria-hidden="true" /></span><p className="mt-4 font-medium">{rows.length ? "No matching records" : "No receipts yet"}</p><p className="mt-1 text-sm text-muted-foreground">{rows.length ? "Try a different search." : "Scan a source to create the first receipt record."}</p></div>
        </div>
      )}
    </section>
  )
}
