import type { ReceiptExtraction } from "@/lib/receipt-types"
export const REVIEWABLE_SUGGESTION_KEYS=[
  "expenseCategory",
  "merchantName",
  "merchantAddress",
  "merchantContacts",
  "merchantTaxIdentifier",
  "sourceNumber",
  "issuedAt",
  "currency",
  "paymentMethod",
  "paymentReference",
  "buyerName",
  "buyerTaxIdentifier",
  "sellerPin",
  "etrScuIdentifier",
  "qrPresent",
  "subtotalMinor",
  "discountMinor",
  "taxMinor",
  "feesMinor",
  "totalMinor",
] as const
export type ReviewableSuggestionKey=(typeof REVIEWABLE_SUGGESTION_KEYS)[number]
const monetary=new Set<ReviewableSuggestionKey>(["subtotalMinor","discountMinor","taxMinor","feesMinor","totalMinor"])
export function hasCalculationMismatch(extraction:ReceiptExtraction){return extraction.calculationWarnings.some(warning=>/\b(mismatch|does not match|do not match|difference|inconsistent|conflict)\b/i.test(warning))}
export function sourceSuggestionKeys(extraction:ReceiptExtraction){return REVIEWABLE_SUGGESTION_KEYS.filter(key=>extraction[key].normalizedValue!==null)}
export function safeSuggestionKeys(extraction:ReceiptExtraction,threshold=.8){const calculationMismatch=hasCalculationMismatch(extraction);return REVIEWABLE_SUGGESTION_KEYS.filter(key=>{const suggestion=extraction[key];return suggestion.normalizedValue!==null&&suggestion.confidence>=threshold&&!(monetary.has(key)&&calculationMismatch)})}
