const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export type InviteGuest = { id: string; name: string }

export type Invite = {
  id: string
  title: string
  details: string
  startsAt: string
  location: string
  guests: InviteGuest[]
}

export type RsvpResult = { attending: boolean; groupChatUrl: string | null }

export type AdminGuest = {
  id: string
  name: string
  rsvp: "yes" | "no" | null
  birthday: string | null
  respondedAt: string | null
}

export type AdminEvent = {
  id: string
  title: string
  startsAt: string
  location: string
  guests: AdminGuest[]
}

/** Thrown for any non-2xx; `status` lets the UI tell 409 from the rest. */
export class InviteApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

async function readError(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
  throw new InviteApiError(body?.error ?? body?.message ?? fallback, res.status)
}

export async function fetchInvite(eventId: string): Promise<Invite> {
  const res = await fetch(`${API_BASE}/invite/${encodeURIComponent(eventId)}`)
  if (!res.ok) return readError(res, "Invite not found")
  return (await res.json()) as Invite
}

export async function sendRsvp(
  eventId: string,
  body: { guestId: string; attending: boolean; birthday: string }
): Promise<RsvpResult> {
  const res = await fetch(`${API_BASE}/invite/${encodeURIComponent(eventId)}/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return readError(res, "Could not send your answer")
  return (await res.json()) as RsvpResult
}

export async function fetchInviteOverview(): Promise<{ events: AdminEvent[] }> {
  const res = await fetch(`${API_BASE}/invite/admin/overview`, { credentials: "include" })
  if (!res.ok) return readError(res, "Could not load responses")
  return (await res.json()) as { events: AdminEvent[] }
}

/** Mirrors the server rule so the dialog can refuse before the round trip. */
export function isPlausibleBirthday(raw: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  const real =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  return real && y >= 1900 && raw <= new Date().toISOString().slice(0, 10)
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

function fourDigitYear(raw: string): number {
  const n = Number(raw)
  if (raw.length === 4) return n
  // Two-digit year: 00..(this year) → 20xx, otherwise 19xx.
  return n <= new Date().getUTCFullYear() % 100 ? 2000 + n : 1900 + n
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/**
 * Lenient birthday parsing for a plain text field, so the native date picker (unreliable
 * on iOS inside a bottom sheet) is not needed. Accepts 1999-10-31, 31/10/1999, 10/31/1999,
 * 31.10.99, 19991031, "Oct 31 1999", "31 Oct 1999", "October 31, 1999". Ambiguous numeric
 * day/month (both <= 12) is read month-first. Returns YYYY-MM-DD or null.
 */
export function parseBirthday(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ")
  let m: RegExpExecArray | null

  m = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/.exec(s)
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(s)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = fourDigitYear(m[3])
    if (a > 12) return toIso(y, b, a)
    return toIso(y, a, b)
  }

  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.? (\d{2}|\d{4})$/.exec(s)
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3)) + 1
    return month ? toIso(fourDigitYear(m[3]), month, Number(m[1])) : null
  }

  m = /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)? (\d{2}|\d{4})$/.exec(s)
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3)) + 1
    return month ? toIso(fourDigitYear(m[3]), month, Number(m[2])) : null
  }

  return null
}
