import { NextResponse } from "next/server"
import { z } from "zod"

import { getRequestSession } from "@/lib/authorization"
import { voidReceipt } from "@/lib/receipt-mutations"

const schema = z.object({ reason: z.string().min(8).max(500) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const { id } = await params
    const { reason } = schema.parse(await request.json())
    await voidReceipt(id, reason, session)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Provide a clear void reason" }, { status: 400 })
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
}
