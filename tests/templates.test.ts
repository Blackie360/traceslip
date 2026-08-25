import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ReceiptPreview } from "@/components/receipts/receipt-preview"
import {
  EMPTY_RECEIPT_VIEW_MODEL,
  RECEIPT_TEMPLATE_IDS,
  TEMPLATE_LABELS,
  type ReceiptTemplateId,
} from "@/lib/receipt-types"

describe("receipt view models", () => {
  it("keeps the ten presets closed and unique", () => {
    expect(RECEIPT_TEMPLATE_IDS).toHaveLength(10)
    expect(new Set(RECEIPT_TEMPLATE_IDS).size).toBe(10)
    for (const templateId of RECEIPT_TEMPLATE_IDS) {
      expect(TEMPLATE_LABELS[templateId]).toBeTruthy()
      expect({ ...EMPTY_RECEIPT_VIEW_MODEL, templateId }.templateId).toBe(templateId)
    }
  })

  it("keeps archive and source identifiers separate", () => {
    const model = {
      ...EMPTY_RECEIPT_VIEW_MODEL,
      archiveId: "TS-2026-000001",
      sourceNumber: "MERCHANT-42",
    }
    expect(model.archiveId).not.toBe(model.sourceNumber)
  })

  it("renders a distinct document structure for every preset", () => {
    const signatures: Record<ReceiptTemplateId, string> = {
      "classic-80mm": "Sales receipt",
      "compact-58mm": "*** CUSTOMER COPY ***",
      "supermarket-itemized": "ITEM / QTY",
      "restaurant-hospitality": "Guest check",
      "fuel-forecourt": "Fuel sales receipt",
      "mobile-money-record": "Mobile payment receipt",
      "kenya-tax-reference": "Tax invoice",
      "professional-a4-invoice": "Bill to",
      "service-consulting-invoice": "Prepared for",
      "minimal-ledger-copy": "Payment total",
    }

    for (const templateId of RECEIPT_TEMPLATE_IDS) {
      const html = renderToStaticMarkup(createElement(ReceiptPreview, {
        receipt: { ...EMPTY_RECEIPT_VIEW_MODEL, templateId, hasOriginalSource: true },
      }))
      expect(html).toContain(signatures[templateId])
      expect(html).toContain("Verified digital copy")
      expect(html).toContain('aria-label="Digital-copy status"')
      expect(html.indexOf("Verified digital copy")).toBeGreaterThan(html.indexOf(signatures[templateId]))
      expect(html).not.toContain("TraceSlip")
    }
  })

  it("labels description-only receipts as unverified drafts", () => {
    const html = renderToStaticMarkup(createElement(ReceiptPreview, {
      receipt: EMPTY_RECEIPT_VIEW_MODEL,
    }))
    expect(html).toContain("Unverified draft")
    expect(html).toContain("Attach and validate the original source")
    expect(html).not.toContain("Verified digital copy")
  })
})
