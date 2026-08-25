import { NextResponse } from "next/server"

import { getRequestSession } from "@/lib/authorization"
import { finalizeReceipt } from "@/lib/receipt-mutations"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const { id } = await params
    await finalizeReceipt(id, session)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    const known: Record<string, string> = {
      SOURCE_REQUIRED: "Attach and validate the original source first.",
      TOTALS_MISMATCH: "Fix the calculation warnings before finalizing.",
      REVIEW_REQUIRED: "Merchant and date are required.",
      FINALIZATION_CONFLICT: "This draft changed in another session. Reload and review it.",
    }
    if (known[message]) return NextResponse.json({ error: known[message] }, { status: 409 })
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
}
