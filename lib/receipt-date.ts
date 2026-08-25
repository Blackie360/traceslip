type ReceiptDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const localReceiptTimestamp = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
const absoluteTimestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i

function partsAsUtc(parts: ReceiptDateParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

function validCalendarParts(parts: ReceiptDateParts) {
  const date = new Date(partsAsUtc(parts))
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() + 1 === parts.month
    && date.getUTCDate() === parts.day
    && date.getUTCHours() === parts.hour
    && date.getUTCMinutes() === parts.minute
    && date.getUTCSeconds() === parts.second
}

function partsInTimezone(date: Date, timeZone: string): ReceiptDateParts {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value])
  )

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function sameParts(left: ReceiptDateParts, right: ReceiptDateParts) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second
}

function parseLocalTimestamp(value: string): ReceiptDateParts | null {
  const match = localReceiptTimestamp.exec(value)
  if (!match) return null

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  }
  return validCalendarParts(parts) ? parts : null
}

export function normalizeReceiptTimestamp(value: string | null, timeZone: string): string | null {
  const cleanValue = value?.trim()
  if (!cleanValue) return null

  if (absoluteTimestamp.test(cleanValue)) {
    const normalizedOffset = cleanValue.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    const date = new Date(normalizedOffset)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const target = parseLocalTimestamp(cleanValue)
  if (!target) return null

  try {
    const targetMilliseconds = partsAsUtc(target)
    let instantMilliseconds = targetMilliseconds

    // Convert a wall-clock receipt time into UTC using the receipt's IANA timezone.
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const observed = partsInTimezone(new Date(instantMilliseconds), timeZone)
      instantMilliseconds += targetMilliseconds - partsAsUtc(observed)
    }

    const instant = new Date(instantMilliseconds)
    return sameParts(partsInTimezone(instant, timeZone), target) ? instant.toISOString() : null
  } catch {
    return null
  }
}

export function isReceiptTimestamp(value: string) {
  return normalizeReceiptTimestamp(value, "UTC") !== null
}

export function receiptTimestampToLocalInput(value: string | null, timeZone: string) {
  const normalized = normalizeReceiptTimestamp(value, timeZone)
  if (!normalized) return ""
  const parts = partsInTimezone(new Date(normalized), timeZone)
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}
