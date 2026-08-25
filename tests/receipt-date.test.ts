import { describe, expect, it } from "vitest"

import {
  isReceiptTimestamp,
  normalizeReceiptTimestamp,
  receiptTimestampToLocalInput,
} from "@/lib/receipt-date"

describe("receipt date normalization", () => {
  it("interprets an extracted wall-clock timestamp in the receipt timezone", () => {
    expect(normalizeReceiptTimestamp("2026-08-14 18:28", "Africa/Nairobi"))
      .toBe("2026-08-14T15:28:00.000Z")
  })

  it("preserves absolute timestamps and renders their receipt-local value", () => {
    const timestamp = normalizeReceiptTimestamp("2026-08-14T15:28:00+00:00", "Africa/Nairobi")
    expect(timestamp).toBe("2026-08-14T15:28:00.000Z")
    expect(receiptTimestampToLocalInput(timestamp, "Africa/Nairobi")).toBe("2026-08-14T18:28")
  })

  it("rejects impossible and ambiguous date strings", () => {
    expect(isReceiptTimestamp("2026-02-30 18:28")).toBe(false)
    expect(isReceiptTimestamp("14/08/2026 18:28")).toBe(false)
  })
})
