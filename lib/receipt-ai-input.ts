type ReceiptSourceInput = {
  bytes: Uint8Array
  mimeType: string
  filename: string
}

export function buildReceiptSourceContent(input: ReceiptSourceInput) {
  const base64 = Buffer.from(input.bytes).toString("base64")

  if (input.mimeType === "application/pdf") {
    return {
      type: "input_file",
      file_data: `data:${input.mimeType};base64,${base64}`,
      filename: input.filename,
      detail: "high",
    } as const
  }

  return {
    type: "input_image",
    image_url: `data:${input.mimeType};base64,${base64}`,
    detail: "high",
  } as const
}
