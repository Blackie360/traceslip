import { desc, eq } from "drizzle-orm"

import { PageHeader } from "@/components/page-header"
import { ReceiptRegister } from "@/components/receipts/receipt-register"
import { projects, receipts } from "@/db/schema"
import { requireWorkspace } from "@/lib/authorization"
import { db } from "@/lib/db"

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
})

export default async function ReceiptRegisterPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const access = await requireWorkspace(workspaceSlug)
  const rows = await db
    .select({
      id: receipts.id,
      archiveId: receipts.archiveId,
      sourceNumber: receipts.sourceNumber,
      merchantName: receipts.merchantName,
      status: receipts.status,
      totalMinor: receipts.totalMinor,
      currency: receipts.currency,
      issuedAt: receipts.issuedAt,
      projectName: projects.name,
    })
    .from(receipts)
    .innerJoin(projects, eq(projects.id, receipts.projectId))
    .where(eq(receipts.organizationId, access.organizationId))
    .orderBy(desc(receipts.createdAt))
  const base = `/app/${workspaceSlug}`

  return (
    <>
      <PageHeader
        eyebrow="Controlled register"
        title="Receipts"
        description="Select any receipt to view its source, details, or downloadable copy."
      />
      <ReceiptRegister
        rows={rows.map(({ issuedAt, ...row }) => ({
          ...row,
          issuedDate: issuedAt ? dateFormatter.format(issuedAt) : null,
        }))}
        base={base}
      />
    </>
  )
}
