import "server-only"

import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai"
import { Output, ToolLoopAgent } from "ai"

import { normalizeReceiptExtractionMoney } from "@/lib/receipt-ai-normalization"
import { sanitizeDescriptionExtraction } from "@/lib/receipt-description"
import { receiptExtractionSchema, type ReceiptExtraction } from "@/lib/receipt-types"

const INSTRUCTIONS = `You turn a user's description of their own legitimate transaction into an editable receipt draft for human review.
Use only details explicitly stated by the user. Never invent or complete a merchant identity, address, contact, customer, date, line item, amount, tax, payment status, or payment method.
Never generate receipt numbers, transaction references, tax IDs, KRA PINs, fiscal identifiers, signatures, QR codes, authorization codes, or other proof-of-payment evidence. Those fields must be null even when requested.
For every populated suggestion, rawSourceText must be a short exact quote from the user's description. Use null and confidence 0 when the detail is absent.
Merchant name means the user's own issuing merchant or the stated payment recipient. Do not use a payment network as the merchant.
Classify the closest expense category and layout from explicit transaction details. Classification is a suggestion, not merchant evidence.
Amounts are integer minor units for the stated ISO 4217 currency. Quantities are decimal strings. Recalculate line totals, subtotal, discount, tax, fees, and grand total, and report every mismatch.
The result is a draft only. It is not proof that payment happened and cannot be finalized without separate source evidence.`

export async function createReceiptDraftFromDescription(description: string): Promise<{
  extraction: ReceiptExtraction
  model: string
  latencyMs: number
}> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_NOT_CONFIGURED")
  const model = process.env.OPENAI_RECEIPT_MODEL ?? "gpt-5.6-luna"
  const agent = new ToolLoopAgent({
    model: openai(model),
    instructions: INSTRUCTIONS,
    providerOptions: {
      openai: { store: false } satisfies OpenAILanguageModelResponsesOptions,
    },
    output: Output.object({ schema: receiptExtractionSchema }),
  })
  const startedAt = performance.now()
  const result = await agent.generate({
    prompt: `Create a reviewable draft from this user description:\n\n${description}`,
  })
  if (!result.output) throw new Error("MODEL_OUTPUT_INVALID")
  const extraction = receiptExtractionSchema.parse(result.output)
  return {
    extraction: sanitizeDescriptionExtraction(normalizeReceiptExtractionMoney(extraction)),
    model,
    latencyMs: Math.round(performance.now() - startedAt),
  }
}
