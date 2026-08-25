import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"

import { ReceiptPdfDocument } from "@/lib/receipt-pdf"
import type { ReceiptViewModel } from "@/lib/receipt-types"

export async function renderReceiptPdf(receipt: ReceiptViewModel, format: "thermal" | "a4") {
  return renderToBuffer(<ReceiptPdfDocument receipt={receipt} format={format} />)
}
