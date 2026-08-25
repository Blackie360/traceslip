import { NextResponse } from "next/server"
import { z } from "zod"

import { getRequestSession } from "@/lib/authorization"
import { getReceiptViewModel } from "@/lib/receipt-data"
import { saveReceiptDraft } from "@/lib/receipt-mutations"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const { id } = await params
    return NextResponse.json(await getReceiptViewModel(id, session.user.id))
  } catch {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const { id } = await params
    const result = await saveReceiptDraft(id, await request.json(), session)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Review the highlighted receipt fields", issues: error.issues }, { status: 400 })
    console.error("receipt save failed", error)
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
}
