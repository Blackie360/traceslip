import { describe, expect, it } from "vitest"

import { normalizeReceiptExtraction, normalizeReceiptExtractionMoney } from "@/lib/receipt-ai-normalization"
import { receiptExtractionSchema } from "@/lib/receipt-types"

const suggestion = (normalizedValue: unknown, rawSourceText: string | null) => ({
  normalizedValue,
  rawSourceText,
  confidence: 0.99,
})

function extraction(totalMinor: number, rawSourceText: string) {
  return receiptExtractionSchema.parse({
    schemaVersion: "1.1",
    suggestedDocumentKind: "receipt",
    suggestedTemplateId: "mobile-money-record",
    expenseCategory: suggestion("telecommunications", "Connectivity service"),
    merchantName: suggestion("TINGG", "Paid To: TINGG"),
    merchantAddress: suggestion(null, null),
    merchantContacts: suggestion(null, null),
    merchantTaxIdentifier: suggestion(null, null),
    sourceNumber: suggestion("UHEL630Z3C", "Transaction No: UHEL630Z3C"),
    issuedAt: suggestion("2026-08-14T18:28:00", "Date: 14th Aug 2026 6:28 PM"),
    currency: suggestion("KES", "KES 49,230"),
    paymentMethod: suggestion("Pay Bill", "Payment Type: Pay Bill"),
    paymentReference: suggestion("UHEL630Z3C", "Transaction No: UHEL630Z3C"),
    buyerName: suggestion(null, null),
    buyerTaxIdentifier: suggestion(null, null),
    sellerPin: suggestion(null, null),
    etrScuIdentifier: suggestion(null, null),
    qrPresent: suggestion(false, "No QR visible"),
    lines: [],
    subtotalMinor: suggestion(null, null),
    discountMinor: suggestion(null, null),
    taxMinor: suggestion(null, null),
    feesMinor: suggestion(null, null),
    totalMinor: suggestion(totalMinor, rawSourceText),
    calculationWarnings: [],
  })
}

describe("receipt extraction money normalization", () => {
  it("converts a model-returned KES major amount into minor units", () => {
    expect(normalizeReceiptExtractionMoney(extraction(49230, "Total Amount Paid: KES 49,230")).totalMinor.normalizedValue).toBe(4923000)
  })

  it("does not multiply an amount already returned in minor units", () => {
    expect(normalizeReceiptExtractionMoney(extraction(4923000, "Total Amount Paid: KES 49,230")).totalMinor.normalizedValue).toBe(4923000)
  })

  it("handles source amounts with decimal major units", () => {
    expect(normalizeReceiptExtractionMoney(extraction(49230, "Total Amount Paid: KES 492.30")).totalMinor.normalizedValue).toBe(49230)
  })

  it("does not warn when the source states only a grand total", () => {
    const result = extraction(4923000, "Total Amount Paid: KES 49,230")
    result.calculationWarnings = ["No subtotal, tax, fees, or discount is provided."]
    expect(normalizeReceiptExtraction(result).calculationWarnings).toEqual([])
  })
})
