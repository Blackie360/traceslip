import { z } from "zod"

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const PROJECT_ROLES = ["manager", "contributor", "viewer"] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]

export const RECEIPT_STATUSES = ["draft", "final", "void"] as const
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number]

export const EXTRACTION_STATUSES = [
  "pending",
  "processing",
  "complete",
  "failed",
] as const
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number]

export const DOCUMENT_KINDS = ["receipt", "invoice"] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const EXPENSE_CATEGORIES = [
  "meals",
  "accommodation",
  "transport",
  "fuel",
  "airfare",
  "office-supplies",
  "software",
  "professional-services",
  "telecommunications",
  "utilities",
  "healthcare",
  "other",
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  meals: "Meals & entertainment",
  accommodation: "Accommodation",
  transport: "Ground transport",
  fuel: "Fuel",
  airfare: "Airfare",
  "office-supplies": "Office supplies",
  software: "Software & subscriptions",
  "professional-services": "Professional services",
  telecommunications: "Phone & internet",
  utilities: "Utilities",
  healthcare: "Healthcare",
  other: "Other",
}

export const RECEIPT_TEMPLATE_IDS = [
  "classic-80mm",
  "compact-58mm",
  "supermarket-itemized",
  "restaurant-hospitality",
  "fuel-forecourt",
  "mobile-money-record",
  "kenya-tax-reference",
  "professional-a4-invoice",
  "service-consulting-invoice",
  "minimal-ledger-copy",
] as const
export type ReceiptTemplateId = (typeof RECEIPT_TEMPLATE_IDS)[number]

export const TEMPLATE_LABELS: Record<ReceiptTemplateId, string> = {
  "classic-80mm": "Classic 80mm thermal",
  "compact-58mm": "Compact 58mm till",
  "supermarket-itemized": "Supermarket itemized",
  "restaurant-hospitality": "Restaurant & hospitality",
  "fuel-forecourt": "Fuel & forecourt",
  "mobile-money-record": "Mobile-money record",
  "kenya-tax-reference": "Kenya tax-invoice reference",
  "professional-a4-invoice": "Professional A4 invoice",
  "service-consulting-invoice": "Service & consulting invoice",
  "minimal-ledger-copy": "Minimal ledger copy",
}

export type SourceSuggestion<T> = {
  normalizedValue: T | null
  rawSourceText: string | null
  confidence: number
}

export type ReceiptLineViewModel = {
  id: string
  description: string
  quantity: string
  unitPriceMinor: number
  discountMinor: number
  taxMinor: number
  totalMinor: number
}

export type ReceiptViewModel = {
  id: string
  archiveId: string
  sourceNumber: string | null
  hasOriginalSource: boolean
  status: ReceiptStatus
  documentKind: DocumentKind
  expenseCategory: ExpenseCategory | null
  templateId: ReceiptTemplateId
  merchant: {
    name: string
    address: string | null
    contacts: string | null
    logoUrl: string | null
    taxIdentifier: string | null
  }
  buyer: {
    name: string | null
    taxIdentifier: string | null
  }
  issuedAt: string | null
  currency: string
  locale: string
  timezone: string
  lines: ReceiptLineViewModel[]
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  feesMinor: number
  totalMinor: number
  paymentMethod: string | null
  paymentReference: string | null
  fiscal: {
    sellerPin: string | null
    buyerPin: string | null
    etrScuIdentifier: string | null
    qrPresent: boolean | null
  }
  notes: string | null
  footer: string | null
  finalizedAt: string | null
  voidedAt: string | null
  voidReason: string | null
}

const suggestion = <T extends z.ZodType>(schema: T) =>
  z.object({
    normalizedValue: schema.nullable(),
    rawSourceText: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  })

export const receiptExtractionSchema = z.object({
  schemaVersion: z.literal("1.1"),
  suggestedDocumentKind: z.enum(DOCUMENT_KINDS),
  suggestedTemplateId: z.enum(RECEIPT_TEMPLATE_IDS),
  expenseCategory: suggestion(z.enum(EXPENSE_CATEGORIES)),
  merchantName: suggestion(z.string()),
  merchantAddress: suggestion(z.string()),
  merchantContacts: suggestion(z.string()),
  merchantTaxIdentifier: suggestion(z.string()),
  sourceNumber: suggestion(z.string()),
  issuedAt: suggestion(z.string()),
  currency: suggestion(z.string().length(3)),
  paymentMethod: suggestion(z.string()),
  paymentReference: suggestion(z.string()),
  buyerName: suggestion(z.string()),
  buyerTaxIdentifier: suggestion(z.string()),
  sellerPin: suggestion(z.string()),
  etrScuIdentifier: suggestion(z.string()),
  qrPresent: suggestion(z.boolean()),
  lines: z.array(
    z.object({
      description: suggestion(z.string()),
      quantity: suggestion(z.string()),
      unitPriceMinor: suggestion(z.number().int()),
      discountMinor: suggestion(z.number().int()),
      taxMinor: suggestion(z.number().int()),
      totalMinor: suggestion(z.number().int()),
    })
  ),
  subtotalMinor: suggestion(z.number().int()),
  discountMinor: suggestion(z.number().int()),
  taxMinor: suggestion(z.number().int()),
  feesMinor: suggestion(z.number().int()),
  totalMinor: suggestion(z.number().int()),
  calculationWarnings: z.array(z.string()),
})

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>

export const EMPTY_RECEIPT_VIEW_MODEL: ReceiptViewModel = {
  id: "preview",
  archiveId: "TS-DRAFT",
  sourceNumber: null,
  hasOriginalSource: false,
  status: "draft",
  documentKind: "receipt",
  expenseCategory: null,
  templateId: "classic-80mm",
  merchant: {
    name: "Merchant name",
    address: null,
    contacts: null,
    logoUrl: null,
    taxIdentifier: null,
  },
  buyer: { name: null, taxIdentifier: null },
  issuedAt: null,
  currency: "KES",
  locale: "en-KE",
  timezone: "Africa/Nairobi",
  lines: [],
  subtotalMinor: 0,
  discountMinor: 0,
  taxMinor: 0,
  feesMinor: 0,
  totalMinor: 0,
  paymentMethod: null,
  paymentReference: null,
  fiscal: {
    sellerPin: null,
    buyerPin: null,
    etrScuIdentifier: null,
    qrPresent: null,
  },
  notes: null,
  footer: null,
  finalizedAt: null,
  voidedAt: null,
  voidReason: null,
}
