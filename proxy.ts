import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const isAppRoute = request.nextUrl.pathname.startsWith("/app")
  const isAuthRoute = ["/sign-in", "/sign-up"].includes(request.nextUrl.pathname)

  if (isAppRoute && !sessionCookie) return NextResponse.redirect(new URL("/sign-in", request.url))
  if (isAuthRoute && sessionCookie) return NextResponse.redirect(new URL("/app", request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/sign-in", "/sign-up"],
}
