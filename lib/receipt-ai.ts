import "server-only"

import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"

import { buildReceiptSourceContent } from "@/lib/receipt-ai-input"
import { normalizeReceiptExtraction } from "@/lib/receipt-ai-normalization"
import { receiptExtractionSchema, type ReceiptExtraction } from "@/lib/receipt-types"

export const RECEIPT_EXTRACTION_PIPELINE_VERSION = "1.2"

const EXTRACTION_INSTRUCTIONS = `You extract facts from a receipt or invoice source for human review.
Return only visible, source-backed information. Never invent a merchant, logo, identifier, tax PIN, signature, payment reference, fiscal identifier, or QR code.
For each field include a normalized value, the exact short source text supporting it, and confidence from 0 to 1. Use null values and null source text when absent.
merchantName means the seller or payment recipient. On mobile-money confirmations, use the visibly printed "Paid To", recipient, payee, or business name. Never use the payment network, wallet provider, bank, card scheme, or logo (for example M-PESA or Safaricom) as merchantName unless it is explicitly the payment recipient.
Classify expenseCategory only from visible merchant, item, or service evidence. Category is a reviewable classification, not a fact printed by the merchant. Use null when the visible evidence is too weak.
All monetary values are integer minor units for the detected ISO 4217 currency. Convert visible major-unit amounts using the currency fraction digits: for example KES 49,230 must be 4923000 minor units, not 49230. Quantities are decimal strings.
Only return line items or service descriptions that are visibly stated. If the source does not describe what was purchased, return an empty lines array so the user can add the service description during review.
Choose the closest TraceSlip template. Kenya fiscal fields are facts only when visibly printed. qrPresent describes whether a QR is visibly present; it does not recreate the QR.
Compare only monetary values that are visibly stated. Missing subtotal, tax, fees, discount, or line items are valid and must not create a warning. Add a concise calculation warning only when stated figures contradict one another.
This output is a suggestion. It will never be applied or saved automatically.`

type ExtractSourceInput = {
  bytes: Uint8Array
  mimeType: string
  filename: string
  enhanced?: boolean
}

export async function extractReceiptSource(input: ExtractSourceInput): Promise<{
  extraction: ReceiptExtraction
  model: string
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
}> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_NOT_CONFIGURED")
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = input.enhanced
    ? process.env.OPENAI_ENHANCED_MODEL ?? "gpt-5.6-terra"
    : process.env.OPENAI_RECEIPT_MODEL ?? "gpt-5.6-luna"
  const source = buildReceiptSourceContent(input)
  const startedAt = performance.now()

  const response = await client.responses.parse({
    model,
    store: false,
    instructions: EXTRACTION_INSTRUCTIONS,
    input: [{ role: "user", content: [{ type: "input_text", text: "Extract this source into the TraceSlip review schema." }, source] }],
    text: { format: zodTextFormat(receiptExtractionSchema, "traceslip_receipt_extraction") },
  })

  if (!response.output_parsed) throw new Error("MODEL_OUTPUT_INVALID")
  const parsed = receiptExtractionSchema.parse(response.output_parsed)
  return {
    extraction: normalizeReceiptExtraction(parsed),
    model,
    latencyMs: Math.round(performance.now() - startedAt),
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  }
}
