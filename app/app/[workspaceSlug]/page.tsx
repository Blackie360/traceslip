import { and, count, desc, eq, sql } from "drizzle-orm"
import { ArrowRight, FolderKanban, ReceiptText, WalletCards } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { projects, receipts } from "@/db/schema"
import { requireWorkspace } from "@/lib/authorization"
import { db } from "@/lib/db"
import { formatMoney } from "@/lib/money"

function MetricCard({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof ReceiptText; label: string; value: React.ReactNode; detail: string; tone?: "default" | "warning" | "success" }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-5">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <span className={tone === "warning" ? "grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600" : tone === "success" ? "grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600" : "grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground"}><Icon className="size-4" aria-hidden="true" /></span>
      </CardHeader>
      <CardContent className="px-5"><p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
    </Card>
  )
}

export default async function WorkspaceDashboard({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const access = await requireWorkspace(workspaceSlug)
  const orgId = access.organizationId
  const [[projectCount], [receiptCount], recent, currencyTotals] = await Promise.all([
    db.select({ value: count() }).from(projects).where(eq(projects.organizationId, orgId)),
    db.select({ value: count() }).from(receipts).where(eq(receipts.organizationId, orgId)),
    db.select({ id: receipts.id, archiveId: receipts.archiveId, merchantName: receipts.merchantName, status: receipts.status, totalMinor: receipts.totalMinor, currency: receipts.currency, createdAt: receipts.createdAt }).from(receipts).where(eq(receipts.organizationId, orgId)).orderBy(desc(receipts.createdAt)).limit(6),
    db.select({ currency: receipts.currency, total: sql<number>`coalesce(sum(${receipts.totalMinor}),0)::bigint` }).from(receipts).where(and(eq(receipts.organizationId, orgId), eq(receipts.status, "final"))).groupBy(receipts.currency),
  ])
  const base = `/app/${workspaceSlug}`
  const finalValue = currencyTotals.length
    ? currencyTotals.map((row) => formatMoney(Number(row.total), row.currency)).join(" · ")
    : "—"

  return (
    <>
      <PageHeader eyebrow="Workspace overview" title="Overview" description="Track your receipt records, recorded value, and recent activity." />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={ReceiptText} label="Total receipts" value={receiptCount.value} detail={`Across ${projectCount.value} project${projectCount.value === 1 ? "" : "s"}`} />
        <MetricCard icon={FolderKanban} label="Active projects" value={projectCount.value} detail="Workspace access boundaries" />
        <MetricCard icon={WalletCards} label="Recorded value" value={finalValue} detail="Currencies remain separate" tone="success" />
      </div>

      <section className="app-panel mt-6">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div><h2 className="font-semibold">Recent receipt activity</h2><p className="mt-0.5 text-sm text-muted-foreground">Latest records across the workspace</p></div>
          <Link href={`${base}/receipts`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">View all <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
        </div>
        <div className="hidden grid-cols-[1fr_.65fr_auto] gap-4 app-table-head sm:grid"><span>Record</span><span className="text-right">Amount</span><span className="w-16 text-right">Open</span></div>
        {recent.length ? recent.map((receipt) => (
          <Link key={receipt.id} href={`${base}/receipts/${receipt.id}`} className="group grid gap-3 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[1fr_.65fr_auto] sm:items-center">
            <div><p className="flex items-center gap-2 font-medium group-hover:text-accent"><span>{receipt.merchantName || "Merchant pending"}</span>{receipt.status === "void" ? <Badge variant="destructive">Void</Badge> : null}</p><p className="text-xs text-muted-foreground">{receipt.archiveId}</p></div>
            <p className="text-sm font-medium tabular-nums sm:text-right">{formatMoney(receipt.totalMinor, receipt.currency)}</p>
            <span className="flex items-center gap-1 text-sm font-medium text-accent sm:w-16 sm:justify-end">View <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        )) : (
          <div className="grid min-h-60 place-items-center p-8 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-muted"><ReceiptText className="size-5 text-muted-foreground" aria-hidden="true" /></span><p className="mt-4 font-medium">No receipts yet</p><p className="mt-1 text-sm text-muted-foreground">Scan the first source to begin your register.</p><Link href={`${base}/receipts/new`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}>Create first receipt</Link></div></div>
        )}
      </section>
    </>
  )
}
