import {
  hasCalculationMismatch,
  safeSuggestionKeys,
  type ReviewableSuggestionKey,
} from "@/lib/extraction-review"
import type {
  ReceiptExtraction,
  ReceiptLineViewModel,
  ReceiptViewModel,
  SourceSuggestion,
} from "@/lib/receipt-types"

function valueOf<T>(suggestion: SourceSuggestion<T>): T | null {
  return suggestion.normalizedValue
}

function safeLines(extraction: ReceiptExtraction): ReceiptLineViewModel[] {
  if (hasCalculationMismatch(extraction)) return []

  return extraction.lines.flatMap((line, index) => {
    const fields = Object.values(line)
    if (fields.some((field) => field.normalizedValue === null || field.confidence < 0.8)) return []

    return [{
      id: `auto-line-${index}`,
      description: String(line.description.normalizedValue),
      quantity: String(line.quantity.normalizedValue),
      unitPriceMinor: Number(line.unitPriceMinor.normalizedValue),
      discountMinor: Number(line.discountMinor.normalizedValue),
      taxMinor: Number(line.taxMinor.normalizedValue),
      totalMinor: Number(line.totalMinor.normalizedValue),
    }]
  })
}

export function applyReceiptExtraction(
  receipt: ReceiptViewModel,
  extraction: ReceiptExtraction,
  keys: readonly ReviewableSuggestionKey[] = safeSuggestionKeys(extraction)
): ReceiptViewModel {
  let next: ReceiptViewModel = {
    ...receipt,
    documentKind: extraction.suggestedDocumentKind,
    templateId: extraction.suggestedTemplateId,
  }

  for (const key of keys) {
    switch (key) {
      case "expenseCategory":
        next = { ...next, expenseCategory: valueOf(extraction[key]) }
        break
      case "merchantName":
        next = { ...next, merchant: { ...next.merchant, name: String(valueOf(extraction[key])) } }
        break
      case "merchantAddress":
        next = { ...next, merchant: { ...next.merchant, address: String(valueOf(extraction[key])) } }
        break
      case "merchantContacts":
        next = { ...next, merchant: { ...next.merchant, contacts: String(valueOf(extraction[key])) } }
        break
      case "merchantTaxIdentifier":
        next = { ...next, merchant: { ...next.merchant, taxIdentifier: String(valueOf(extraction[key])) } }
        break
      case "buyerName":
        next = { ...next, buyer: { ...next.buyer, name: String(valueOf(extraction[key])) } }
        break
      case "buyerTaxIdentifier":
        next = { ...next, buyer: { ...next.buyer, taxIdentifier: String(valueOf(extraction[key])) } }
        break
      case "sellerPin":
        next = { ...next, fiscal: { ...next.fiscal, sellerPin: String(valueOf(extraction[key])) } }
        break
      case "etrScuIdentifier":
        next = { ...next, fiscal: { ...next.fiscal, etrScuIdentifier: String(valueOf(extraction[key])) } }
        break
      case "qrPresent":
        next = { ...next, fiscal: { ...next.fiscal, qrPresent: Boolean(valueOf(extraction[key])) } }
        break
      case "sourceNumber":
      case "issuedAt":
      case "currency":
      case "paymentMethod":
      case "paymentReference":
        next = { ...next, [key]: String(valueOf(extraction[key])) }
        break
      case "subtotalMinor":
      case "discountMinor":
      case "taxMinor":
      case "feesMinor":
      case "totalMinor":
        next = { ...next, [key]: Number(valueOf(extraction[key])) }
        break
    }
  }

  const lines = safeLines(extraction)
  return lines.length ? { ...next, lines } : next
}
