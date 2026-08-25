import { describe, expect, it } from "vitest"

import { buildReceiptSourceContent } from "@/lib/receipt-ai-input"

describe("OpenAI receipt source payloads", () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

  it("wraps inline PDFs in the data URL required by input_file", () => {
    expect(
      buildReceiptSourceContent({ bytes, mimeType: "application/pdf", filename: "invoice.pdf" })
    ).toEqual({
      type: "input_file",
      file_data: "data:application/pdf;base64,JVBERg==",
      filename: "invoice.pdf",
      detail: "high",
    })
  })

  it("keeps image inputs as media-typed data URLs", () => {
    expect(buildReceiptSourceContent({ bytes, mimeType: "image/png", filename: "receipt.png" })).toEqual({
      type: "input_image",
      image_url: "data:image/png;base64,JVBERg==",
      detail: "high",
    })
  })
})
