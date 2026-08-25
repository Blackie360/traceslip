import "server-only"

import { and, asc, eq } from "drizzle-orm"

import { attachments, receiptItems, receipts } from "@/db/schema"
import { AuthorizationError, getProjectAccess } from "@/lib/authorization"
import { db } from "@/lib/db"
import type { ExpenseCategory, ReceiptTemplateId, ReceiptViewModel } from "@/lib/receipt-types"

export async function getReceiptRecordForUser(receiptId: string, userId: string) {
  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1)
  if (!receipt) throw new AuthorizationError()
  const access = await getProjectAccess(userId, receipt.projectId)
  if (access.organizationId !== receipt.organizationId) throw new AuthorizationError()
  return { receipt, access }
}

export async function getReceiptViewModel(receiptId: string, userId: string): Promise<ReceiptViewModel> {
  const { receipt } = await getReceiptRecordForUser(receiptId, userId)
  const [items, [source]] = await Promise.all([
    db.select().from(receiptItems).where(eq(receiptItems.receiptId, receipt.id)).orderBy(asc(receiptItems.position)),
    db.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.receiptId, receipt.id), eq(attachments.isOriginalSource, true), eq(attachments.status, "ready"))).limit(1),
  ])

  const fiscal = receipt.fiscalMetadata as Record<string, unknown>
  return {
    id: receipt.id,
    archiveId: receipt.archiveId,
    sourceNumber: receipt.sourceNumber,
    hasOriginalSource: Boolean(source),
    status: receipt.status as ReceiptViewModel["status"],
    documentKind: receipt.documentKind as ReceiptViewModel["documentKind"],
    expenseCategory: receipt.expenseCategory as ExpenseCategory | null,
    templateId: receipt.templateId as ReceiptTemplateId,
    merchant: {
      name: receipt.merchantName || "Merchant not set",
      address: receipt.merchantAddress,
      contacts: receipt.merchantContacts,
      logoUrl: null,
      taxIdentifier: receipt.merchantTaxIdentifier,
    },
    buyer: { name: receipt.buyerName, taxIdentifier: receipt.buyerTaxIdentifier },
    issuedAt: receipt.issuedAt?.toISOString() ?? null,
    currency: receipt.currency,
    locale: receipt.locale,
    timezone: receipt.timezone,
    lines: items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      discountMinor: item.discountMinor,
      taxMinor: item.taxMinor,
      totalMinor: item.totalMinor,
    })),
    subtotalMinor: receipt.subtotalMinor,
    discountMinor: receipt.discountMinor,
    taxMinor: receipt.taxMinor,
    feesMinor: receipt.feesMinor,
    totalMinor: receipt.totalMinor,
    paymentMethod: receipt.paymentMethod,
    paymentReference: receipt.paymentReference,
    fiscal: {
      sellerPin: typeof fiscal.sellerPin === "string" ? fiscal.sellerPin : null,
      buyerPin: typeof fiscal.buyerPin === "string" ? fiscal.buyerPin : null,
      etrScuIdentifier: typeof fiscal.etrScuIdentifier === "string" ? fiscal.etrScuIdentifier : null,
      qrPresent: typeof fiscal.qrPresent === "boolean" ? fiscal.qrPresent : null,
    },
    notes: receipt.notes,
    footer: receipt.footer,
    finalizedAt: receipt.finalizedAt?.toISOString() ?? null,
    voidedAt: receipt.voidedAt?.toISOString() ?? null,
    voidReason: receipt.voidReason,
  }
}

export async function receiptExistsForProject(receiptId: string, projectId: string) {
  const [row] = await db
    .select({ id: receipts.id })
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.projectId, projectId)))
    .limit(1)
  return Boolean(row)
}
