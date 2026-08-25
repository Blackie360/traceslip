"use client"

import { ArrowRight, ReceiptText, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { StatusBadge } from "@/components/status-badge"
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
  const [status, setStatus] = useState("all")
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesStatus = status === "all" || row.status === status
      const matchesQuery = !normalized || [row.merchantName, row.archiveId, row.sourceNumber, row.projectName]
        .some((value) => value?.toLowerCase().includes(normalized))
      return matchesStatus && matchesQuery
    })
  }, [query, rows, status])

  return (
    <section className="app-panel">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchant, reference, or project" aria-label="Search receipts" className="h-9 bg-background pl-9" />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="receipt-status" className="text-xs font-medium text-muted-foreground">Status</label>
          <select id="receipt-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 min-w-32 border bg-background px-3 text-sm">
            <option value="all">All records</option><option value="draft">Draft</option><option value="final">Final</option><option value="void">Void</option>
          </select>
          <span className="hidden text-xs tabular-nums text-muted-foreground md:block">{filtered.length} of {rows.length}</span>
        </div>
      </div>

      <div className="hidden grid-cols-[1.25fr_.75fr_.55fr_.65fr_.7fr_auto] gap-4 app-table-head md:grid">
        <span>Record</span><span>Project</span><span>Status</span><span>Date</span><span className="text-right">Amount</span><span className="w-16 text-right">Open</span>
      </div>
      {filtered.length ? filtered.map((row) => {
        const merchant = row.merchantName || "Merchant pending"
        return (
          <Link
            key={row.id}
            href={`${base}/receipts/${row.id}`}
            aria-label={`View ${merchant} receipt ${row.archiveId}`}
            className="group grid cursor-pointer gap-3 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/45 focus-visible:z-10 focus-visible:bg-muted/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring md:grid-cols-[1.25fr_.75fr_.55fr_.65fr_.7fr_auto] md:items-center"
          >
            <div className="min-w-0"><p className="truncate font-medium transition-colors group-hover:text-accent">{merchant}</p><p className="truncate text-xs text-muted-foreground">{row.archiveId}{row.sourceNumber ? ` · ${row.sourceNumber}` : ""}</p></div>
            <span className="truncate text-sm text-muted-foreground">{row.projectName}</span>
            <StatusBadge status={row.status} />
            <span className="text-sm text-muted-foreground">{row.issuedDate ?? "—"}</span>
            <span className="text-sm font-medium tabular-nums md:text-right">{formatMoney(row.totalMinor, row.currency)}</span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-accent md:w-16 md:justify-end">View <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        )
      }) : (
        <div className="grid min-h-64 place-items-center p-8 text-center">
          <div><span className="mx-auto grid size-11 place-items-center rounded-full bg-muted"><ReceiptText className="size-5 text-muted-foreground" aria-hidden="true" /></span><p className="mt-4 font-medium">{rows.length ? "No matching records" : "No receipts yet"}</p><p className="mt-1 text-sm text-muted-foreground">{rows.length ? "Try a different search or status filter." : "Scan a source to create the first receipt record."}</p></div>
        </div>
      )}
    </section>
  )
}
