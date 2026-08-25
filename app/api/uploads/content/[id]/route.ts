import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { attachments } from "@/db/schema"
import { db } from "@/lib/db"
import { MAX_UPLOAD_BYTES, sha256Hex } from "@/lib/files"

const MAX_CHUNK_BYTES = 2 * 1024 * 1024

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const token = url.searchParams.get("token")
    const offset = Number(url.searchParams.get("offset") ?? "0")
    if (!token || !Number.isInteger(offset) || offset < 0) return NextResponse.json({ error: "Upload token is invalid" }, { status: 400 })
    const tokenHash = await sha256Hex(new TextEncoder().encode(token).buffer as ArrayBuffer)
    const chunk = new Uint8Array(await request.arrayBuffer())
    if (!chunk.byteLength || chunk.byteLength > MAX_CHUNK_BYTES) return NextResponse.json({ error: "Upload chunk is invalid" }, { status: 400 })

    const [attachment] = await db
      .select({
        id: attachments.id,
        expectedBytes: attachments.byteSize,
        content: attachments.content,
        status: attachments.status,
        uploadTokenHash: attachments.uploadTokenHash,
        uploadTokenExpiresAt: attachments.uploadTokenExpiresAt,
      })
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1)
    if (
      !attachment ||
      attachment.status !== "pending" ||
      attachment.uploadTokenHash !== tokenHash ||
      !attachment.uploadTokenExpiresAt ||
      attachment.uploadTokenExpiresAt.getTime() < Date.now()
    ) return NextResponse.json({ error: "Upload token is invalid or expired" }, { status: 404 })

    const existing = attachment.content ? new Uint8Array(attachment.content) : new Uint8Array()
    if (existing.byteLength !== offset) return NextResponse.json({ error: "Upload offset does not match" }, { status: 409 })
    const nextLength = existing.byteLength + chunk.byteLength
    if (nextLength > attachment.expectedBytes || nextLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Upload exceeds the declared size" }, { status: 400 })
    const combined = new Uint8Array(nextLength)
    combined.set(existing)
    combined.set(chunk, existing.byteLength)
    await db
      .update(attachments)
      .set({ content: combined })
      .where(eq(attachments.id, attachment.id))
    return NextResponse.json({ uploadedBytes: nextLength, complete: nextLength === attachment.expectedBytes })
  } catch (error) {
    console.error("database upload failed", error)
    return NextResponse.json({ error: "Unable to store upload chunk" }, { status: 400 })
  }
}
