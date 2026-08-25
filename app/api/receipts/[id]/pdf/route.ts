import { NextResponse } from "next/server"
import { auditEvents } from "@/db/schema"
import { getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
import { sanitizeFilename } from "@/lib/files"
import { getReceiptRecordForUser, getReceiptViewModel } from "@/lib/receipt-data"
import { renderReceiptPdf } from "@/lib/receipt-pdf-renderer"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })

    const { id } = await params
    const format = new URL(request.url).searchParams.get("format") === "a4" ? "a4" : "thermal"
    const record = await getReceiptRecordForUser(id, session.user.id)
    const receipt = await getReceiptViewModel(id, session.user.id)

    if (!receipt.hasOriginalSource) {
      return NextResponse.json(
        { error: "Attach and validate the original transaction source before exporting a receipt." },
        { status: 409 },
      )
    }

    const pdf = await renderReceiptPdf(receipt, format)
    await db.insert(auditEvents).values({
      organizationId: record.receipt.organizationId,
      actorUserId: session.session.impersonatedBy ?? session.user.id,
      effectiveUserId: session.user.id,
      action: "receipt.pdf_exported",
      entityType: "receipt",
      entityId: id,
      metadata: { format, impersonated: Boolean(session.session.impersonatedBy) },
    })
    const filename = sanitizeFilename(`${receipt.archiveId}-${receipt.merchant.name}-${format}.pdf`)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("pdf render failed", error)
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
}
