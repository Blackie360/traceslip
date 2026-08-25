const TRANSIENT_DATABASE_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "57P01",
  "57P02",
  "57P03",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
])

type ErrorWithDetails = {
  body?: unknown
  code?: unknown
  cause?: unknown
  errors?: unknown
}

export function isTransientDatabaseError(error: unknown, seen = new Set<unknown>()): boolean {
  if (!error || (typeof error !== "object" && typeof error !== "function") || seen.has(error)) return false
  seen.add(error)

  const details = error as ErrorWithDetails
  if (typeof details.code === "string" && TRANSIENT_DATABASE_CODES.has(details.code.toUpperCase())) return true
  if (isTransientDatabaseError(details.cause, seen)) return true
  if (Array.isArray(details.errors)) return details.errors.some((item) => isTransientDatabaseError(item, seen))
  return false
}

export function isSessionDatabaseError(error: unknown): boolean {
  if (isTransientDatabaseError(error)) return true
  if (!error || typeof error !== "object") return false
  const body = (error as ErrorWithDetails).body
  return Boolean(body && typeof body === "object" && "code" in body && body.code === "FAILED_TO_GET_SESSION")
}
