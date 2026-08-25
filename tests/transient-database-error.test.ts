import { describe, expect, it } from "vitest"

import { isSessionDatabaseError, isTransientDatabaseError } from "@/lib/transient-database-error"

describe("transient database errors", () => {
  it("finds a timeout nested inside an API error and AggregateError", () => {
    const timeout = Object.assign(new Error("connect timed out"), { code: "ETIMEDOUT" })
    const apiError = new Error("Failed to get session", { cause: new AggregateError([timeout]) })

    expect(isTransientDatabaseError(apiError)).toBe(true)
  })

  it("recognizes retryable PostgreSQL connection states", () => {
    expect(isTransientDatabaseError({ code: "08006" })).toBe(true)
    expect(isTransientDatabaseError({ code: "57P03" })).toBe(true)
  })

  it("recognizes Better Auth session lookup failures after it strips the database cause", () => {
    expect(isSessionDatabaseError({ body: { code: "FAILED_TO_GET_SESSION" } })).toBe(true)
  })

  it("does not retry validation or authorization failures", () => {
    expect(isTransientDatabaseError(Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" }))).toBe(false)
    expect(isTransientDatabaseError(new Error("Invalid receipt"))).toBe(false)
  })
})
