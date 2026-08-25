import { and, eq, gte, lt, ne, or, sql, type SQL } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { aiExtractionAttempts, attachments, auditEvents, receipts } from "@/db/schema"
import { assertMutableSession, canEditReceipt, getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
import { extractReceiptSource, RECEIPT_EXTRACTION_PIPELINE_VERSION } from "@/lib/receipt-ai"
import { getReceiptRecordForUser } from "@/lib/receipt-data"
import { receiptExtractionSchema, type ReceiptExtraction } from "@/lib/receipt-types"

const schema = z.object({ attachmentId: z.string().uuid(), enhanced: z.boolean().default(false) })

async function findPossibleDuplicates(
  organizationId: string,
  receiptId: string,
  extraction: ReceiptExtraction
) {
  const matchers: SQL[] = []
  const sourceNumber = extraction.sourceNumber.normalizedValue?.trim()
  const paymentReference = extraction.paymentReference.normalizedValue?.trim()
  const merchantName = extraction.merchantName.normalizedValue?.trim()
  const totalMinor = extraction.totalMinor.normalizedValue
  const issuedAt = extraction.issuedAt.normalizedValue

  if (sourceNumber) {
    matchers.push(sql`lower(trim(${receipts.sourceNumber})) = ${sourceNumber.toLowerCase()}`)
  }
  if (paymentReference) {
    matchers.push(sql`lower(trim(${receipts.paymentReference})) = ${paymentReference.toLowerCase()}`)
  }
  if (merchantName && totalMinor !== null && issuedAt) {
    const issuedDate = new Date(issuedAt)
    if (!Number.isNaN(issuedDate.valueOf())) {
      const dayStart = new Date(issuedDate)
      dayStart.setUTCHours(0, 0, 0, 0)
      const nextDay = new Date(dayStart)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      matchers.push(and(
        sql`lower(trim(${receipts.merchantName})) = ${merchantName.toLowerCase()}`,
        eq(receipts.totalMinor, totalMinor),
        gte(receipts.issuedAt, dayStart),
        lt(receipts.issuedAt, nextDay)
      )!)
    }
  }
  if (!matchers.length) return []

  const rows = await db
    .select({
      id: receipts.id,
      archiveId: receipts.archiveId,
      status: receipts.status,
      merchantName: receipts.merchantName,
      sourceNumber: receipts.sourceNumber,
      paymentReference: receipts.paymentReference,
      issuedAt: receipts.issuedAt,
      currency: receipts.currency,
      totalMinor: receipts.totalMinor,
    })
    .from(receipts)
    .where(and(
      eq(receipts.organizationId, organizationId),
      ne(receipts.id, receiptId),
      ne(receipts.status, "void"),
      or(...matchers)
    ))
    .limit(3)

  return rows.map((row) => ({
    id: row.id,
    archiveId: row.archiveId,
    status: row.status,
    merchantName: row.merchantName,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    currency: row.currency,
    totalMinor: row.totalMinor,
    reason: sourceNumber && row.sourceNumber?.toLowerCase() === sourceNumber.toLowerCase()
      ? "Same source number"
      : paymentReference && row.paymentReference?.toLowerCase() === paymentReference.toLowerCase()
        ? "Same payment reference"
        : "Same merchant, date, and total",
  }))
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let attemptId: string | null = null
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    assertMutableSession(session)
    const { id: receiptId } = await params
    const input = schema.parse(await request.json())
    const { receipt, access } = await getReceiptRecordForUser(receiptId, session.user.id)
    if (receipt.status !== "draft" || !canEditReceipt(access, receipt.createdById, session.user.id)) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    }
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, input.attachmentId), eq(attachments.receiptId, receiptId), eq(attachments.status, "ready")))
      .limit(1)
    if (!attachment) return NextResponse.json({ error: "Resource not found" }, { status: 404 })

    const model = input.enhanced
      ? process.env.OPENAI_ENHANCED_MODEL ?? "gpt-5.6-terra"
      : process.env.OPENAI_RECEIPT_MODEL ?? "gpt-5.6-luna"
    const idempotencyKey = `${attachment.id}:${model}:${RECEIPT_EXTRACTION_PIPELINE_VERSION}`
    const [existing] = await db
      .select()
      .from(aiExtractionAttempts)
      .where(eq(aiExtractionAttempts.idempotencyKey, idempotencyKey))
      .limit(1)
    if (existing?.status === "complete" && existing.result) {
      const parsed = receiptExtractionSchema.safeParse(existing.result)
      if (parsed.success) {
        const possibleDuplicates = await findPossibleDuplicates(receipt.organizationId, receiptId, parsed.data)
        return NextResponse.json({ extraction: parsed.data, cached: true, possibleDuplicates })
      }
    }
    if (existing?.status === "processing") return NextResponse.json({ error: "Extraction is already processing" }, { status: 409 })

    if (existing) {
      attemptId = existing.id
      await db.update(aiExtractionAttempts).set({ status: "processing", safeErrorCode: null, safeErrorMessage: null }).where(eq(aiExtractionAttempts.id, existing.id))
    } else {
      const [attempt] = await db
        .insert(aiExtractionAttempts)
        .values({
          receiptId,
          attachmentId: attachment.id,
          idempotencyKey,
          model,
          schemaVersion: RECEIPT_EXTRACTION_PIPELINE_VERSION,
          status: "processing",
          createdById: session.user.id,
        })
        .returning({ id: aiExtractionAttempts.id })
      attemptId = attempt.id
    }

    if (!attachment.content) throw new Error("SOURCE_DOWNLOAD_FAILED")
    const output = await extractReceiptSource({
      bytes: new Uint8Array(attachment.content),
      mimeType: attachment.mimeType,
      filename: attachment.originalFilename,
      enhanced: input.enhanced,
    })
    await db.transaction(async (tx) => {
      await tx
        .update(aiExtractionAttempts)
        .set({
          status: "complete",
          result: output.extraction,
          model: output.model,
          latencyMs: output.latencyMs,
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          completedAt: new Date(),
        })
        .where(eq(aiExtractionAttempts.id, attemptId!))
      await tx.insert(auditEvents).values({
        organizationId: receipt.organizationId,
        actorUserId: session.user.id,
        effectiveUserId: session.user.id,
        action: "receipt.extraction_completed",
        entityType: "receipt",
        entityId: receipt.id,
        metadata: { attemptId, model: output.model, enhanced: input.enhanced },
      })
    })
    const possibleDuplicates = await findPossibleDuplicates(receipt.organizationId, receiptId, output.extraction)
    return NextResponse.json({ extraction: output.extraction, cached: false, possibleDuplicates })
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "EXTRACTION_FAILED"
    if (attemptId) {
      await db
        .update(aiExtractionAttempts)
        .set({ status: "failed", safeErrorCode: code, safeErrorMessage: "The source could not be extracted. Retry or enter it manually.", completedAt: new Date() })
        .where(eq(aiExtractionAttempts.id, attemptId))
        .catch(() => undefined)
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid extraction request" }, { status: 400 })
    if (code === "OPENAI_NOT_CONFIGURED") return NextResponse.json({ error: "AI extraction is not configured. Manual entry is still available." }, { status: 503 })
    console.error("receipt extraction failed", code)
    return NextResponse.json({ error: "Extraction failed. Retry or continue with manual entry." }, { status: 502 })
  }
}
