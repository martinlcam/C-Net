const BIRTHDAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A plausible birthday: YYYY-MM-DD, a real calendar date, 1900 or later, not in the
 * future. Compared as date strings in UTC so "today" is accepted everywhere.
 */
export function isValidBirthday(raw: string): boolean {
  const m = BIRTHDAY_RE.exec(raw)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false
  }
  const today = new Date().toISOString().slice(0, 10)
  return raw <= today
}
