const SAFE_EXTENSION = /[^a-zA-Z0-9._-]+/g

export function sanitizeFilename(filename: string, fallback = "traceslip-document") {
  const sanitized = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(SAFE_EXTENSION, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120)
  return sanitized || fallback
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const signatures = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
  webpRiff: [0x52, 0x49, 0x46, 0x46],
  webp: [0x57, 0x45, 0x42, 0x50],
}

function beginsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[index + offset] === value)
}

export function detectAllowedMime(bytes: Uint8Array): string | null {
  if (beginsWith(bytes, signatures.jpeg)) return "image/jpeg"
  if (beginsWith(bytes, signatures.png)) return "image/png"
  if (beginsWith(bytes, signatures.pdf)) return "application/pdf"
  if (beginsWith(bytes, signatures.webpRiff) && beginsWith(bytes, signatures.webp, 8)) return "image/webp"
  return null
}

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
