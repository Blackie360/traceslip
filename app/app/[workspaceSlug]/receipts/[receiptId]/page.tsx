import { and, desc, eq } from "drizzle-orm"

import { ReceiptWorkbench } from "@/components/receipts/receipt-workbench"
import { aiExtractionAttempts, attachments } from "@/db/schema"
import { requireWorkspace } from "@/lib/authorization"
import { db } from "@/lib/db"
import { getReceiptViewModel } from "@/lib/receipt-data"
import { receiptExtractionSchema } from "@/lib/receipt-types"

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; receiptId: string }>
}) {
  const { workspaceSlug, receiptId } = await params
  const access = await requireWorkspace(workspaceSlug)
  const receipt = await getReceiptViewModel(receiptId, access.session.user.id)
  const [[source], [attempt]] = await Promise.all([
    db
      .select({ id: attachments.id, mimeType: attachments.mimeType })
      .from(attachments)
      .where(
        and(
          eq(attachments.receiptId, receiptId),
          eq(attachments.isOriginalSource, true),
          eq(attachments.status, "ready")
        )
      )
      .limit(1),
    db
      .select({ result: aiExtractionAttempts.result })
      .from(aiExtractionAttempts)
      .where(
        and(
          eq(aiExtractionAttempts.receiptId, receiptId),
          eq(aiExtractionAttempts.status, "complete")
        )
      )
      .orderBy(desc(aiExtractionAttempts.completedAt))
      .limit(1),
  ])
  const parsedExtraction = receiptExtractionSchema.safeParse(attempt?.result)

  return (
    <ReceiptWorkbench
      projects={[]}
      initialReceipt={receipt}
      initialAttachmentId={source?.id}
      initialAttachmentMime={source?.mimeType}
      initialExtraction={parsedExtraction.success ? parsedExtraction.data : null}
    />
  )
}
