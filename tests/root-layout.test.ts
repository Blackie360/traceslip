import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("root layout", () => {
  const layout = fs.readFileSync("app/layout.tsx", "utf8")

  it("initializes the theme during HTML parsing without next/script", () => {
    expect(layout).not.toContain('from "next/script"')
    expect(layout).toContain("<head>")
    expect(layout).toContain("<InlineScript html={themeInitializer} />")
  })
})
