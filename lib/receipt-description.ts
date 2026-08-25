import type { ReceiptExtraction, SourceSuggestion } from "@/lib/receipt-types"

function absentSuggestion<T>(): SourceSuggestion<T> {
  return { normalizedValue: null, rawSourceText: null, confidence: 0 }
}

export function sanitizeDescriptionExtraction(extraction: ReceiptExtraction): ReceiptExtraction {
  return {
    ...extraction,
    merchantTaxIdentifier: absentSuggestion<string>(),
    sourceNumber: absentSuggestion<string>(),
    paymentReference: absentSuggestion<string>(),
    buyerTaxIdentifier: absentSuggestion<string>(),
    sellerPin: absentSuggestion<string>(),
    etrScuIdentifier: absentSuggestion<string>(),
    qrPresent: absentSuggestion<boolean>(),
  }
}
