import { NextResponse } from "next/server"
import { z } from "zod"

import { AuthorizationError, getRequestSession } from "@/lib/authorization"
import { getReceiptViewModel } from "@/lib/receipt-data"
import { saveReceiptDraft } from "@/lib/receipt-mutations"
import { isSessionDatabaseError } from "@/lib/transient-database-error"

function unavailableResponse() {
  return NextResponse.json({
    error: "The database connection was interrupted. Your changes are still on this page—try Save again.",
    code: "DATABASE_TEMPORARILY_UNAVAILABLE",
  }, { status: 503, headers: { "Retry-After": "1" } })
}

function isNotFoundError(error: unknown) {
  return error instanceof AuthorizationError || (error instanceof Error && error.message === "NOT_FOUND")
}

function logSafeRouteError(action: "load" | "save", error: unknown) {
  console.error(`receipt ${action} failed`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
    transientDatabaseError: isSessionDatabaseError(error),
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession()
    if (!session) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    const { id } = await params
    return NextResponse.json(await getReceiptViewModel(id, session.user.id))
  } catch (error) {
    if (isSessionDatabaseError(error)) {
      logSafeRouteError("load", error)
      return unavailableResponse()
    }
    if (isNotFoundError(error)) return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    logSafeRouteError("load", error)
    return NextResponse.json({ error: "Unable to load receipt" }, { status: 500 })
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
    if (isSessionDatabaseError(error)) {
      logSafeRouteError("save", error)
      return unavailableResponse()
    }
    if (isNotFoundError(error)) return NextResponse.json({ error: "This receipt no longer exists. Return to Receipts and scan it again." }, { status: 404 })
    logSafeRouteError("save", error)
    return NextResponse.json({ error: "Unable to save receipt" }, { status: 500 })
  }
}
