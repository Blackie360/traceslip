export function safeAuthCallback(value: string | string[] | undefined, fallback = "/app") {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate?.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback

  try {
    const base = new URL("https://traceslip.local")
    const parsed = new URL(candidate, base)
    if (parsed.origin !== base.origin) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
