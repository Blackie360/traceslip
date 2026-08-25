import { describe, expect, it } from "vitest"

import { applyReceiptExtraction } from "@/lib/receipt-auto-fill"
import { EMPTY_RECEIPT_VIEW_MODEL, receiptExtractionSchema } from "@/lib/receipt-types"

const suggestion = (normalizedValue: unknown, confidence = 0.95) => ({
  normalizedValue,
  rawSourceText: normalizedValue === null ? null : String(normalizedValue),
  confidence,
})

function extraction(warnings: string[] = []) {
  return receiptExtractionSchema.parse({
    schemaVersion: "1.1",
    suggestedDocumentKind: "receipt",
    suggestedTemplateId: "mobile-money-record",
    expenseCategory: suggestion("telecommunications"),
    merchantName: suggestion("Tingg"),
    merchantAddress: suggestion("Nairobi"),
    merchantContacts: suggestion(null),
    merchantTaxIdentifier: suggestion(null),
    sourceNumber: suggestion("UHEL630Z3C"),
    issuedAt: suggestion("2026-08-14T18:28:00.000Z"),
    currency: suggestion("KES"),
    paymentMethod: suggestion("Pay Bill"),
    paymentReference: suggestion("UHEL630Z3C"),
    buyerName: suggestion(null),
    buyerTaxIdentifier: suggestion(null),
    sellerPin: suggestion(null),
    etrScuIdentifier: suggestion(null),
    qrPresent: suggestion(false),
    lines: [{
      description: suggestion("Connectivity service"),
      quantity: suggestion("1"),
      unitPriceMinor: suggestion(4_923_000),
      discountMinor: suggestion(0),
      taxMinor: suggestion(0),
      totalMinor: suggestion(4_923_000),
    }],
    subtotalMinor: suggestion(4_923_000),
    discountMinor: suggestion(0),
    taxMinor: suggestion(0),
    feesMinor: suggestion(0),
    totalMinor: suggestion(4_923_000),
    calculationWarnings: warnings,
  })
}

describe("automatic receipt fill", () => {
  it("fills high-confidence source-backed fields and safe line items", () => {
    const receipt = applyReceiptExtraction(EMPTY_RECEIPT_VIEW_MODEL, extraction())
    expect(receipt.merchant.name).toBe("Tingg")
    expect(receipt.merchant.address).toBe("Nairobi")
    expect(receipt.paymentMethod).toBe("Pay Bill")
    expect(receipt.expenseCategory).toBe("telecommunications")
    expect(receipt.totalMinor).toBe(4_923_000)
    expect(receipt.lines[0]?.description).toBe("Connectivity service")
    expect(receipt.templateId).toBe("mobile-money-record")
  })

  it("does not apply monetary fields or lines when calculations conflict", () => {
    const receipt = applyReceiptExtraction(
      EMPTY_RECEIPT_VIEW_MODEL,
      extraction(["Subtotal and total mismatch"])
    )
    expect(receipt.merchant.name).toBe("Tingg")
    expect(receipt.totalMinor).toBe(0)
    expect(receipt.lines).toHaveLength(0)
  })
})
