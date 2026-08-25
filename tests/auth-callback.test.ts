import { describe, expect, it } from "vitest"

import { safeAuthCallback } from "@/lib/auth-callback"

describe("safe auth callback", () => {
  it("preserves an invitation route", () => {
    expect(safeAuthCallback("/accept-invitation?id=invite-123"))
      .toBe("/accept-invitation?id=invite-123")
  })

  it("rejects external and protocol-relative redirects", () => {
    expect(safeAuthCallback("https://attacker.example/path")).toBe("/app")
    expect(safeAuthCallback("//attacker.example/path")).toBe("/app")
    expect(safeAuthCallback("/\\attacker.example/path")).toBe("/app")
  })

  it("uses the first callback value and supports a custom fallback", () => {
    expect(safeAuthCallback(["/accept-invitation?id=one", "/app"])).toBe("/accept-invitation?id=one")
    expect(safeAuthCallback(undefined, "/sign-in")).toBe("/sign-in")
  })
})
