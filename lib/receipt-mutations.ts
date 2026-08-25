import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

import { auditEvents, attachments, receiptItems, receiptVersions, receipts } from "@/db/schema"
import {
  assertMutableSession,
  canEditReceipt,
  canFinalizeReceipt,
  canVoidReceipt,
  type getRequestSession,
} from "@/lib/authorization"
import { db } from "@/lib/db"
import { reconcileTotals } from "@/lib/money"
import { getReceiptRecordForUser } from "@/lib/receipt-data"
import { DOCUMENT_KINDS, EXPENSE_CATEGORIES, RECEIPT_TEMPLATE_IDS } from "@/lib/receipt-types"

type Session = NonNullable<Awaited<ReturnType<typeof getRequestSession>>>

export const receiptDraftSchema = z.object({
  sourceNumber: z.string().trim().max(120).nullable(),
  documentKind: z.enum(DOCUMENT_KINDS),
  expenseCategory: z.enum(EXPENSE_CATEGORIES).nullable(),
  templateId: z.enum(RECEIPT_TEMPLATE_IDS),
  merchantName: z.string().trim().min(1).max(240),
  merchantAddress: z.string().trim().max(500).nullable(),
  merchantContacts: z.string().trim().max(240).nullable(),
  merchantTaxIdentifier: z.string().trim().max(120).nullable(),
  buyerName: z.string().trim().max(240).nullable(),
  buyerTaxIdentifier: z.string().trim().max(120).nullable(),
  issuedAt: z.string().datetime().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  subtotalMinor: z.number().int(),
  discountMinor: z.number().int().min(0),
  taxMinor: z.number().int().min(0),
  feesMinor: z.number().int().min(0),
  totalMinor: z.number().int(),
  paymentMethod: z.string().trim().max(120).nullable(),
  paymentReference: z.string().trim().max(160).nullable(),
  fiscal: z.object({
    sellerPin: z.string().trim().max(80).nullable(),
    buyerPin: z.string().trim().max(80).nullable(),
    etrScuIdentifier: z.string().trim().max(120).nullable(),
    qrPresent: z.boolean().nullable(),
  }),
  notes: z.string().trim().max(1200).nullable(),
  lines: z.array(
    z.object({
      id: z.string().optional(),
      description: z.string().trim().min(1).max(500),
      quantity: z.string().regex(/^\d+(\.\d{1,6})?$/),
      unitPriceMinor: z.number().int(),
      discountMinor: z.number().int().min(0),
      taxMinor: z.number().int().min(0),
      totalMinor: z.number().int(),
    })
  ).max(500),
})

async function snapshotReceipt(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], receiptId: string, reason: string, actorId: string) {
  const [receipt] = await tx.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1)
  const items = await tx.select().from(receiptItems).where(eq(receiptItems.receiptId, receiptId)).orderBy(asc(receiptItems.position))
  if (!receipt) throw new Error("NOT_FOUND")
  await tx.insert(receiptVersions).values({
    receiptId,
    version: receipt.lockVersion,
    snapshot: { receipt, items },
    reason,
    createdById: actorId,
  })
}

export async function saveReceiptDraft(receiptId: string, rawInput: unknown, session: Session) {
  assertMutableSession(session)
  const input = receiptDraftSchema.parse(rawInput)
  const { receipt, access } = await getReceiptRecordForUser(receiptId, session.user.id)
  if (receipt.status !== "draft" || !canEditReceipt(access, receipt.createdById, session.user.id)) throw new Error("NOT_FOUND")
  const totals = reconcileTotals(input)

  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(receipts).where(eq(receipts.id, receipt.id)).for("update").limit(1)
    if (!locked || locked.status !== "draft") throw new Error("NOT_FOUND")
    await snapshotReceipt(tx, locked.id, "draft.saved", session.user.id)
    await tx.delete(receiptItems).where(eq(receiptItems.receiptId, locked.id))
    if (input.lines.length) {
      await tx.insert(receiptItems).values(
        input.lines.map((line, position) => ({
          receiptId: locked.id,
          position,
          description: line.description,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          discountMinor: line.discountMinor,
          taxMinor: line.taxMinor,
          totalMinor: line.totalMinor,
        }))
      )
    }
    await tx
      .update(receipts)
      .set({
        sourceNumber: input.sourceNumber,
        documentKind: input.documentKind,
        expenseCategory: input.expenseCategory,
        templateId: input.templateId,
        merchantName: input.merchantName,
        merchantAddress: input.merchantAddress,
        merchantContacts: input.merchantContacts,
        merchantTaxIdentifier: input.merchantTaxIdentifier,
        buyerName: input.buyerName,
        buyerTaxIdentifier: input.buyerTaxIdentifier,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
        currency: input.currency,
        subtotalMinor: input.subtotalMinor,
        discountMinor: input.discountMinor,
        taxMinor: input.taxMinor,
        feesMinor: input.feesMinor,
        totalMinor: input.totalMinor,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference,
        fiscalMetadata: input.fiscal,
        notes: input.notes,
        calculationWarnings: totals.warnings,
        updatedById: session.user.id,
        updatedAt: new Date(),
        lockVersion: locked.lockVersion + 1,
      })
      .where(and(eq(receipts.id, locked.id), eq(receipts.lockVersion, locked.lockVersion), eq(receipts.status, "draft")))
    await tx.insert(auditEvents).values({
      organizationId: receipt.organizationId,
      actorUserId: session.user.id,
      effectiveUserId: session.user.id,
      action: "receipt.draft_saved",
      entityType: "receipt",
      entityId: receipt.id,
      metadata: { lockVersion: locked.lockVersion + 1, warnings: totals.warnings },
    })
  })
  return { warnings: totals.warnings }
}

export async function finalizeReceipt(receiptId: string, session: Session) {
  assertMutableSession(session)
  const record = await getReceiptRecordForUser(receiptId, session.user.id)
  if (!canFinalizeReceipt(record.access, record.receipt.createdById, session.user.id)) throw new Error("NOT_FOUND")

  await db.transaction(async (tx) => {
    const [receipt] = await tx.select().from(receipts).where(eq(receipts.id, receiptId)).for("update").limit(1)
    if (!receipt || receipt.status !== "draft") throw new Error("NOT_FOUND")
    const items = await tx.select().from(receiptItems).where(eq(receiptItems.receiptId, receiptId))
    const [source] = await tx
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(eq(attachments.receiptId, receiptId), eq(attachments.isOriginalSource, true), eq(attachments.status, "ready")))
      .limit(1)
    if (!source) throw new Error("SOURCE_REQUIRED")
    const totals = reconcileTotals({ ...receipt, lines: items })
    if (totals.warnings.length) throw new Error("TOTALS_MISMATCH")
    if (!receipt.merchantName || !receipt.issuedAt || !items.length) throw new Error("REVIEW_REQUIRED")

    await snapshotReceipt(tx, receipt.id, "receipt.finalized", session.user.id)
    const updated = await tx
      .update(receipts)
      .set({
        status: "final",
        finalizedById: session.user.id,
        finalizedAt: new Date(),
        updatedById: session.user.id,
        updatedAt: new Date(),
        lockVersion: receipt.lockVersion + 1,
      })
      .where(and(eq(receipts.id, receipt.id), eq(receipts.status, "draft"), eq(receipts.lockVersion, receipt.lockVersion)))
      .returning({ id: receipts.id })
    if (!updated.length) throw new Error("FINALIZATION_CONFLICT")
    await tx.insert(auditEvents).values({
      organizationId: receipt.organizationId,
      actorUserId: session.user.id,
      effectiveUserId: session.user.id,
      action: "receipt.finalized",
      entityType: "receipt",
      entityId: receipt.id,
      metadata: { archiveId: receipt.archiveId },
    })
  })
}

export async function voidReceipt(receiptId: string, reason: string, session: Session) {
  assertMutableSession(session)
  const record = await getReceiptRecordForUser(receiptId, session.user.id)
  if (!canVoidReceipt(record.access) || record.receipt.status !== "final") throw new Error("NOT_FOUND")
  const cleanReason = z.string().trim().min(8).max(500).parse(reason)
  await db.transaction(async (tx) => {
    const [receipt] = await tx.select().from(receipts).where(eq(receipts.id, receiptId)).for("update").limit(1)
    if (!receipt || receipt.status !== "final") throw new Error("NOT_FOUND")
    await snapshotReceipt(tx, receipt.id, "receipt.voided", session.user.id)
    await tx
      .update(receipts)
      .set({
        status: "void",
        voidedById: session.user.id,
        voidedAt: new Date(),
        voidReason: cleanReason,
        updatedById: session.user.id,
        updatedAt: new Date(),
        lockVersion: receipt.lockVersion + 1,
      })
      .where(and(eq(receipts.id, receipt.id), eq(receipts.status, "final")))
    await tx.insert(auditEvents).values({
      organizationId: receipt.organizationId,
      actorUserId: session.user.id,
      effectiveUserId: session.user.id,
      action: "receipt.voided",
      entityType: "receipt",
      entityId: receipt.id,
      reason: cleanReason,
      metadata: { archiveId: receipt.archiveId },
    })
  })
}
