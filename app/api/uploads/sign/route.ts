import { and, eq, ne, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { attachments, projects, receiptCounters, receipts, workspaceSettings } from "@/db/schema"
import { assertMutableSession, canCreateReceipt, canEditReceipt, getProjectAccess, getRequestSession } from "@/lib/authorization"
import { db } from "@/lib/db"
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES, sanitizeFilename, sha256Hex } from "@/lib/files"
import { getReceiptRecordForUser } from "@/lib/receipt-data"

const requestSchema = z.object({
  projectId: z.string().uuid(),
  receiptId: z.string().uuid().optional(),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
})

export async function POST(request: Request) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    assertMutableSession(session)
    const input = requestSchema.parse(await request.json())
    const access = await getProjectAccess(session.user.id, input.projectId)
    if (!canCreateReceipt(access)) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const existing = input.receiptId ? await getReceiptRecordForUser(input.receiptId, session.user.id) : null
    if (existing && (
      existing.receipt.projectId !== input.projectId ||
      existing.receipt.status !== "draft" ||
      !canEditReceipt(existing.access, existing.receipt.createdById, session.user.id)
    )) return NextResponse.json({ error: "Resource not found" }, { status: 404 })

    const [duplicate] = await db
      .select({ id: receipts.id, archiveId: receipts.archiveId })
      .from(receipts)
      .where(and(
        eq(receipts.organizationId, access.organizationId),
        eq(receipts.sourceFingerprint, input.sourceFingerprint),
        input.receiptId ? ne(receipts.id, input.receiptId) : undefined
      ))
      .limit(1)
    if (duplicate) {
      return NextResponse.json({
        error: `This receipt already exists as ${duplicate.archiveId}. Upload rejected.`,
        code: "DUPLICATE_RECEIPT",
        existingReceipt: duplicate,
      }, { status: 409 })
    }

    const uploadToken = `${crypto.randomUUID()}${crypto.randomUUID()}`
    const uploadTokenHash = await sha256Hex(new TextEncoder().encode(uploadToken).buffer as ArrayBuffer)
    const uploadTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const result = await db.transaction(async (tx) => {
      const [project] = await tx
        .select({ organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1)
      if (!project) throw new Error("NOT_FOUND")
      let receipt = existing ? { id: existing.receipt.id, archiveId: existing.receipt.archiveId } : null
      if (!receipt) {
        const [settings] = await tx
          .select()
          .from(workspaceSettings)
          .where(eq(workspaceSettings.organizationId, project.organizationId))
          .limit(1)
        const year = new Date().getUTCFullYear()
        const [counter] = await tx
          .insert(receiptCounters)
          .values({ organizationId: project.organizationId, year, value: 1 })
          .onConflictDoUpdate({
            target: [receiptCounters.organizationId, receiptCounters.year],
            set: { value: sql`${receiptCounters.value} + 1` },
          })
          .returning({ value: receiptCounters.value })
        const archiveId = `TS-${year}-${String(counter.value).padStart(6, "0")}`
        const [createdReceipt] = await tx
          .insert(receipts)
          .values({
            organizationId: project.organizationId,
            projectId: input.projectId,
            archiveId,
            locale: settings?.locale ?? "en-KE",
            timezone: settings?.timezone ?? "Africa/Nairobi",
            currency: settings?.defaultCurrency ?? "KES",
            createdById: session.user.id,
            updatedById: session.user.id,
          })
          .returning({ id: receipts.id, archiveId: receipts.archiveId })
        receipt = createdReceipt
      }
      const extension = input.filename.includes(".") ? input.filename.split(".").pop()?.toLowerCase() : "bin"
      const attachmentId = crypto.randomUUID()
      const storagePath = `${project.organizationId}/${receipt.id}/${attachmentId}.${sanitizeFilename(extension ?? "bin")}`
      await tx.insert(attachments).values({
        id: attachmentId,
        receiptId: receipt.id,
        organizationId: project.organizationId,
        storagePath,
        originalFilename: sanitizeFilename(input.filename, "receipt-source"),
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        uploadTokenHash,
        uploadTokenExpiresAt,
        uploadedById: session.user.id,
      })
      return { receipt, attachmentId, storagePath }
    })

    return NextResponse.json({
      receiptId: result.receipt.id,
      archiveId: result.receipt.archiveId,
      attachmentId: result.attachmentId,
      path: result.storagePath,
      signedUrl: `/api/uploads/content/${result.attachmentId}?token=${encodeURIComponent(uploadToken)}`,
      expiresAt: uploadTokenExpiresAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 })
    console.error("upload sign failed", error)
    return NextResponse.json({ error: "Unable to prepare upload" }, { status: 400 })
  }
}
