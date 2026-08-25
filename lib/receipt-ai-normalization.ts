import { majorToMinor } from "@/lib/money"
import type { ReceiptExtraction, SourceSuggestion } from "@/lib/receipt-types"

function sourceMajorAmount(rawSourceText: string | null): number | null {
  if (!rawSourceText) return null
  const matches = rawSourceText.match(/-?\d[\d,\s]*(?:\.\d+)?/g)
  if (!matches?.length) return null
  const value = Number(matches.at(-1)?.replace(/[\s,]/g, ""))
  return Number.isFinite(value) ? value : null
}

function normalizeMoneySuggestion(
  suggestion: SourceSuggestion<number>,
  currency: string
): SourceSuggestion<number> {
  const sourceMajor = sourceMajorAmount(suggestion.rawSourceText)
  if (suggestion.normalizedValue === null || sourceMajor === null) return suggestion

  const expectedMinor = majorToMinor(sourceMajor, currency)
  if (suggestion.normalizedValue !== sourceMajor || suggestion.normalizedValue === expectedMinor) {
    return suggestion
  }

  return { ...suggestion, normalizedValue: expectedMinor }
}

export function normalizeReceiptExtractionMoney(extraction: ReceiptExtraction): ReceiptExtraction {
  const currency = extraction.currency.normalizedValue
  if (!currency) return extraction

  return {
    ...extraction,
    lines: extraction.lines.map((line) => ({
      ...line,
      unitPriceMinor: normalizeMoneySuggestion(line.unitPriceMinor, currency),
      discountMinor: normalizeMoneySuggestion(line.discountMinor, currency),
      taxMinor: normalizeMoneySuggestion(line.taxMinor, currency),
      totalMinor: normalizeMoneySuggestion(line.totalMinor, currency),
    })),
    subtotalMinor: normalizeMoneySuggestion(extraction.subtotalMinor, currency),
    discountMinor: normalizeMoneySuggestion(extraction.discountMinor, currency),
    taxMinor: normalizeMoneySuggestion(extraction.taxMinor, currency),
    feesMinor: normalizeMoneySuggestion(extraction.feesMinor, currency),
    totalMinor: normalizeMoneySuggestion(extraction.totalMinor, currency),
  }
}
