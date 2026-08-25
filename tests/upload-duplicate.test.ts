import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("duplicate receipt uploads", () => {
  const signRoute = fs.readFileSync("app/api/uploads/sign/route.ts", "utf8")
  const completeRoute = fs.readFileSync("app/api/uploads/complete/route.ts", "utf8")
  const workbench = fs.readFileSync("components/receipts/receipt-workbench.tsx", "utf8")

  it("rejects a known fingerprint before creating an upload", () => {
    expect(signRoute).toContain("input.sourceFingerprint")
    expect(signRoute).toContain('code: "DUPLICATE_RECEIPT"')
    expect(signRoute).toContain("status: 409")
  })

  it("serializes completion checks and discards duplicate source bytes", () => {
    expect(completeRoute).toContain("pg_advisory_xact_lock")
    expect(completeRoute).toContain('status: "rejected", content: null')
    expect(completeRoute).toContain('action: "attachment.rejected_duplicate"')
    expect(completeRoute).toContain("status: 409")
  })

  it("fingerprints locally and stops processing a rejected duplicate", () => {
    expect(workbench).toContain("sha256Hex(await nextFile.arrayBuffer())")
    expect(workbench).toContain('signed.code === "DUPLICATE_RECEIPT"')
    expect(workbench).toContain('completed.code === "DUPLICATE_RECEIPT"')
    expect(workbench).toContain("Nothing was uploaded")
  })
})
