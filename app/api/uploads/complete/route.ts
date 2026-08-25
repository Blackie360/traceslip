import { and, eq, ne } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { attachments, auditEvents, receipts } from "@/db/schema"
import { assertMutableSession, getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
import { detectAllowedMime, MAX_UPLOAD_BYTES, sha256Hex } from "@/lib/files"
import { getReceiptRecordForUser } from "@/lib/receipt-data"

const requestSchema = z.object({ attachmentId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    assertMutableSession(session)
    const { attachmentId } = requestSchema.parse(await request.json())
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, attachmentId)).limit(1)
    if (!attachment || attachment.uploadedById !== session.user.id) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    await getReceiptRecordForUser(attachment.receiptId, session.user.id)

    if (!attachment.content) throw new Error("UPLOAD_NOT_FOUND")
    const bytes = new Uint8Array(attachment.content)
    const detectedMime = detectAllowedMime(bytes)
    if (!detectedMime || detectedMime !== attachment.mimeType || bytes.byteLength !== attachment.byteSize || bytes.byteLength > MAX_UPLOAD_BYTES) {
      await db.update(attachments).set({ status: "rejected", content: null, uploadTokenHash: null, uploadTokenExpiresAt: null }).where(eq(attachments.id, attachment.id))
      return NextResponse.json({ error: "The source file did not pass content validation" }, { status: 400 })
    }

    const fingerprint = await sha256Hex(bytes.buffer as ArrayBuffer)
    const [duplicate] = await db
      .select({ id: receipts.id, archiveId: receipts.archiveId })
      .from(receipts)
      .where(and(eq(receipts.organizationId, attachment.organizationId), eq(receipts.sourceFingerprint, fingerprint), ne(receipts.id, attachment.receiptId)))
      .limit(1)

    await db.transaction(async (tx) => {
      await tx.update(attachments).set({ status: "ready", sha256: fingerprint, uploadTokenHash: null, uploadTokenExpiresAt: null, completedAt: new Date() }).where(eq(attachments.id, attachment.id))
      await tx
        .update(receipts)
        .set({
          sourceFingerprint: fingerprint,
          calculationWarnings: duplicate ? [`Possible duplicate of ${duplicate.archiveId}.`] : [],
          updatedById: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(receipts.id, attachment.receiptId))
      await tx.insert(auditEvents).values({
        organizationId: attachment.organizationId,
        actorUserId: session.user.id,
        effectiveUserId: session.user.id,
        action: "attachment.completed",
        entityType: "receipt",
        entityId: attachment.receiptId,
        metadata: { attachmentId, duplicateReceiptId: duplicate?.id ?? null },
      })
    })
    return NextResponse.json({ ok: true, receiptId: attachment.receiptId, duplicate: duplicate ?? null })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid completion request" }, { status: 400 })
    console.error("upload completion failed", error)
    return NextResponse.json({ error: "Unable to validate upload" }, { status: 400 })
  }
}
