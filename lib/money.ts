const CURRENCY_FRACTION_DIGITS: Record<string, number> = {
  BHD: 3,
  CLP: 0,
  DJF: 0,
  IQD: 3,
  JOD: 3,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  PYG: 0,
  RWF: 0,
  TND: 3,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
}

export function currencyFractionDigits(currency: string): number {
  return CURRENCY_FRACTION_DIGITS[currency.toUpperCase()] ?? 2
}

export function majorToMinor(value: string | number, currency: string): number {
  const numeric = typeof value === "number" ? value : Number(value.replace(/,/g, ""))
  if (!Number.isFinite(numeric)) throw new Error("Invalid monetary value")
  return Math.round(numeric * 10 ** currencyFractionDigits(currency))
}

export function minorToMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyFractionDigits(currency)
}

export function formatMoney(minor: number, currency: string, locale = "en-KE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currencyFractionDigits(currency),
  }).format(minorToMajor(minor, currency))
}

export function calculateLineTotal(input: {
  quantity: string
  unitPriceMinor: number
  discountMinor?: number
  taxMinor?: number
}) {
  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Invalid quantity")
  return Math.round(quantity * input.unitPriceMinor) - (input.discountMinor ?? 0) + (input.taxMinor ?? 0)
}

export function reconcileTotals(input: {
  lines: Array<{ totalMinor: number }>
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  feesMinor: number
  totalMinor: number
}) {
  const calculatedSubtotal = input.lines.reduce((sum, line) => sum + line.totalMinor, 0)
  const calculatedTotal = input.subtotalMinor - input.discountMinor + input.taxMinor + input.feesMinor
  const warnings: string[] = []
  const hasStatedSubtotal = input.subtotalMinor !== 0
  if (hasStatedSubtotal && input.lines.length && calculatedSubtotal !== input.subtotalMinor) {
    warnings.push("Line items do not match the stated subtotal.")
  }
  if (hasStatedSubtotal && calculatedTotal !== input.totalMinor) {
    warnings.push("The stated subtotal and adjustments do not match the stated total.")
  }
  return { calculatedSubtotal, calculatedTotal, warnings }
}
