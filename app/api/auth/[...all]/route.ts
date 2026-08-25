import { toNextJsHandler } from "better-auth/next-js"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const handlers = toNextJsHandler(auth)
export const GET = handlers.GET

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  const path = new URL(request.url).pathname
  if (session?.session.impersonatedBy && !path.endsWith("/admin/stop-impersonating")) {
    return NextResponse.json({ error: "Support view is read-only" }, { status: 403 })
  }
  return handlers.POST(request)
}
