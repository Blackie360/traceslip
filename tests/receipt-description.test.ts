import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ReceiptWorkbench } from "@/components/receipts/receipt-workbench"
import { sanitizeDescriptionExtraction } from "@/lib/receipt-description"
import { EMPTY_RECEIPT_VIEW_MODEL, type ReceiptExtraction, type SourceSuggestion } from "@/lib/receipt-types"

function suggestion<T>(normalizedValue: T, rawSourceText = "user supplied", confidence = 0.95): SourceSuggestion<T> {
  return { normalizedValue, rawSourceText, confidence }
}

const extraction: ReceiptExtraction = {
  schemaVersion: "1.1",
  suggestedDocumentKind: "receipt",
  suggestedTemplateId: "mobile-money-record",
  expenseCategory: suggestion("professional-services"),
  merchantName: suggestion("Loop Bazaar"),
  merchantAddress: suggestion("Nairobi"),
  merchantContacts: suggestion("+254700000000"),
  merchantTaxIdentifier: suggestion("P000000000A"),
  sourceNumber: suggestion("PAL-123"),
  issuedAt: suggestion("2026-08-24T10:00:00.000Z"),
  currency: suggestion("KES"),
  paymentMethod: suggestion("M-PESA"),
  paymentReference: suggestion("ABC123"),
  buyerName: suggestion("Amina"),
  buyerTaxIdentifier: suggestion("A000000000B"),
  sellerPin: suggestion("P000000000A"),
  etrScuIdentifier: suggestion("SCU-123"),
  qrPresent: suggestion(true),
  lines: [{
    description: suggestion("Website maintenance"),
    quantity: suggestion("1"),
    unitPriceMinor: suggestion(250000),
    discountMinor: suggestion(0),
    taxMinor: suggestion(0),
    totalMinor: suggestion(250000),
  }],
  subtotalMinor: suggestion(250000),
  discountMinor: suggestion(0),
  taxMinor: suggestion(0),
  feesMinor: suggestion(0),
  totalMinor: suggestion(250000),
  calculationWarnings: [],
}

describe("description receipt drafts", () => {
  it("keeps the capture screen focused on scan and upload", () => {
    const html = renderToStaticMarkup(createElement(ReceiptWorkbench, {
      projects: [{ id: "10000000-0000-4000-8000-000000000003", name: "Operations" }],
    }))

    expect(html).toContain("Scan or upload your receipt")
    expect(html).toContain("Take photo")
    expect(html).toContain("Choose file")
    expect(html).not.toContain("Describe the transaction")
    expect(html).not.toContain("Handled automatically")
    expect(html).not.toContain("File this receipt under")
  })

  it("shows a compact project picker only when there is a choice", () => {
    const html = renderToStaticMarkup(createElement(ReceiptWorkbench, {
      projects: [
        { id: "10000000-0000-4000-8000-000000000003", name: "Operations" },
        { id: "10000000-0000-4000-8000-000000000004", name: "Events" },
      ],
    }))

    expect(html).toContain('aria-label="Project"')
    expect(html).toContain("Operations")
    expect(html).toContain("Events")
  })

  it("uses one save action without exposing finalization or draft status", () => {
    const html = renderToStaticMarkup(createElement(ReceiptWorkbench, {
      projects: [],
      initialReceipt: {
        ...EMPTY_RECEIPT_VIEW_MODEL,
        id: "10000000-0000-4000-8000-000000000005",
        archiveId: "TS-2026-000005",
        hasOriginalSource: true,
      },
    }))

    expect(html).toContain("Save receipt")
    expect(html).not.toContain("Finalize receipt")
    expect(html).not.toContain("Final receipt")
    expect(html).not.toContain("Unverified draft")
  })

  it("keeps useful transaction details while removing proof-only identifiers", () => {
    const sanitized = sanitizeDescriptionExtraction(extraction)

    expect(sanitized.merchantName.normalizedValue).toBe("Loop Bazaar")
    expect(sanitized.lines[0]?.description.normalizedValue).toBe("Website maintenance")
    expect(sanitized.totalMinor.normalizedValue).toBe(250000)
    expect(sanitized.sourceNumber.normalizedValue).toBeNull()
    expect(sanitized.paymentReference.normalizedValue).toBeNull()
    expect(sanitized.merchantTaxIdentifier.normalizedValue).toBeNull()
    expect(sanitized.buyerTaxIdentifier.normalizedValue).toBeNull()
    expect(sanitized.sellerPin.normalizedValue).toBeNull()
    expect(sanitized.etrScuIdentifier.normalizedValue).toBeNull()
    expect(sanitized.qrPresent.normalizedValue).toBeNull()
  })
})
