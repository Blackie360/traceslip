import { eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auditEvents, receiptCounters, receiptItems, receipts, workspaceSettings } from "@/db/schema"
import { createReceiptDraftFromDescription } from "@/lib/agents/receipt-draft-agent"
import { assertMutableSession, canCreateReceipt, getProjectAccess, getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
import { safeSuggestionKeys } from "@/lib/extraction-review"
import { reconcileTotals } from "@/lib/money"
import { applyReceiptExtraction } from "@/lib/receipt-auto-fill"
import { EMPTY_RECEIPT_VIEW_MODEL } from "@/lib/receipt-types"

const requestSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().trim().min(20).max(4000),
})

export async function POST(request: Request) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    assertMutableSession(session)
    const input = requestSchema.parse(await request.json())
    const access = await getProjectAccess(session.user.id, input.projectId)
    if (!canCreateReceipt(access)) return NextResponse.json({ error: "Resource not found" }, { status: 404 })

    const [settings] = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.organizationId, access.organizationId))
      .limit(1)
    const output = await createReceiptDraftFromDescription(input.description)
    const baseReceipt = {
      ...EMPTY_RECEIPT_VIEW_MODEL,
      locale: settings?.locale ?? "en-KE",
      timezone: settings?.timezone ?? "Africa/Nairobi",
      currency: settings?.defaultCurrency ?? "KES",
    }
    const draft = applyReceiptExtraction(baseReceipt, output.extraction, safeSuggestionKeys(output.extraction))
    const issuedAt = draft.issuedAt && !Number.isNaN(new Date(draft.issuedAt).valueOf()) ? new Date(draft.issuedAt) : null
    const totals = reconcileTotals(draft)

    const created = await db.transaction(async (tx) => {
      const year = new Date().getUTCFullYear()
      const [counter] = await tx
        .insert(receiptCounters)
        .values({ organizationId: access.organizationId, year, value: 1 })
        .onConflictDoUpdate({
          target: [receiptCounters.organizationId, receiptCounters.year],
          set: { value: sql`${receiptCounters.value} + 1` },
        })
        .returning({ value: receiptCounters.value })
      const archiveId = `TS-${year}-${String(counter.value).padStart(6, "0")}`
      const [receipt] = await tx
        .insert(receipts)
        .values({
          organizationId: access.organizationId,
          projectId: input.projectId,
          archiveId,
          documentKind: draft.documentKind,
          expenseCategory: draft.expenseCategory,
          templateId: draft.templateId,
          merchantName: draft.merchant.name === EMPTY_RECEIPT_VIEW_MODEL.merchant.name ? "" : draft.merchant.name,
          merchantAddress: draft.merchant.address,
          merchantContacts: draft.merchant.contacts,
          buyerName: draft.buyer.name,
          issuedAt,
          currency: draft.currency,
          locale: draft.locale,
          timezone: draft.timezone,
          subtotalMinor: draft.subtotalMinor,
          discountMinor: draft.discountMinor,
          taxMinor: draft.taxMinor,
          feesMinor: draft.feesMinor,
          totalMinor: draft.totalMinor,
          paymentMethod: draft.paymentMethod,
          calculationWarnings: totals.warnings,
          notes: draft.notes,
          createdById: session.user.id,
          updatedById: session.user.id,
        })
        .returning({ id: receipts.id, archiveId: receipts.archiveId })
      if (draft.lines.length) {
        await tx.insert(receiptItems).values(draft.lines.map((line, position) => ({
          receiptId: receipt.id,
          position,
          description: line.description,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          discountMinor: line.discountMinor,
          taxMinor: line.taxMinor,
          totalMinor: line.totalMinor,
          sourceEvidence: { origin: "user-description", requiresAttachment: true },
        })))
      }
      await tx.insert(auditEvents).values({
        organizationId: access.organizationId,
        actorUserId: session.user.id,
        effectiveUserId: session.user.id,
        action: "receipt.description_draft_created",
        entityType: "receipt",
        entityId: receipt.id,
        metadata: {
          model: output.model,
          latencyMs: output.latencyMs,
          descriptionLength: input.description.length,
          requiresSourceAttachment: true,
        },
      })
      return receipt
    })

    return NextResponse.json({
      receipt: {
        ...draft,
        id: created.id,
        archiveId: created.archiveId,
        issuedAt: issuedAt?.toISOString() ?? null,
      },
      extraction: output.extraction,
      requiresSourceAttachment: true,
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Describe the merchant, transaction, and amount in at least 20 characters." }, { status: 400 })
    const code = error instanceof Error ? error.message : "DRAFT_FAILED"
    if (code === "OPENAI_NOT_CONFIGURED") return NextResponse.json({ error: "AI drafting is not configured. Upload a source or enter the receipt manually." }, { status: 503 })
    console.error("description receipt draft failed", code)
    return NextResponse.json({ error: "The draft could not be created. Review the description and retry." }, { status: 502 })
  }
}
