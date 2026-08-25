import { describe, expect, it } from "vitest"

import { calculateLineTotal, currencyFractionDigits, majorToMinor, minorToMajor, reconcileTotals } from "@/lib/money"

describe("money", () => {
  it("respects ISO currency precision", () => {
    expect(currencyFractionDigits("KES")).toBe(2)
    expect(currencyFractionDigits("JPY")).toBe(0)
    expect(currencyFractionDigits("KWD")).toBe(3)
    expect(majorToMinor("1,234.56", "KES")).toBe(123456)
    expect(minorToMajor(123456, "KES")).toBe(1234.56)
  })

  it("calculates line totals in minor units", () => {
    expect(calculateLineTotal({ quantity: "2.5", unitPriceMinor: 1000, discountMinor: 100, taxMinor: 400 })).toBe(2800)
  })

  it("flags mismatched stated subtotals and totals", () => {
    expect(reconcileTotals({ lines: [{ totalMinor: 1000 }], subtotalMinor: 900, discountMinor: 0, taxMinor: 100, feesMinor: 0, totalMinor: 900 }).warnings).toHaveLength(2)
  })

  it("accepts a receipt that states only a grand total", () => {
    expect(reconcileTotals({ lines: [], subtotalMinor: 0, discountMinor: 0, taxMinor: 0, feesMinor: 0, totalMinor: 4_923_000 }).warnings).toEqual([])
  })
})
