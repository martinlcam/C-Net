export type VaultRole = "super" | "storage"

export type AllowlistEntry = {
  email: string
  role: VaultRole
  quotaBytes: number | null // null = unlimited
}

const UNIT_MULTIPLIER: Record<string, number> = {
  K: 1024,
  M: 1024 ** 2,
  G: 1024 ** 3,
  T: 1024 ** 4,
}

/** Parse a binary size like "1T", "500G", "250M", or a plain byte count. */
export function parseSize(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGT])?B?$/i.exec(input.trim())
  if (!match) throw new Error(`Invalid size: ${input}`)
  const value = Number.parseFloat(match[1])
  const unit = match[2]?.toUpperCase()
  return Math.round(value * (unit ? UNIT_MULTIPLIER[unit] : 1))
}

/** Default allowlist preserves the pre-existing single-owner behavior. */
const DEFAULT_SUPER_EMAIL = "martinlucam@gmail.com"

type RawEntry = { email: string; role: VaultRole; quota?: string | null }

export function parseAllowlist(raw: string | undefined): AllowlistEntry[] {
  const source = raw?.trim()
  if (!source) {
    return [{ email: DEFAULT_SUPER_EMAIL.toLowerCase(), role: "super", quotaBytes: null }]
  }
  const parsed = JSON.parse(source) as RawEntry[]
  return parsed.map((e) => ({
    email: e.email.trim().toLowerCase(),
    role: e.role,
    quotaBytes: e.quota ? parseSize(e.quota) : null,
  }))
}

/** Lazily parse from VAULT_ALLOWLIST unless an explicit list is passed (tests). */
export function currentAllowlist(list?: AllowlistEntry[]): AllowlistEntry[] {
  return list ?? parseAllowlist(process.env.VAULT_ALLOWLIST)
}

export function getAllowlistEntry(email: string, list?: AllowlistEntry[]): AllowlistEntry | null {
  const needle = email.trim().toLowerCase()
  return currentAllowlist(list).find((e) => e.email === needle) ?? null
}

export function isEmailAuthorized(email: string, list?: AllowlistEntry[]): boolean {
  return getAllowlistEntry(email, list) !== null
}

/** True only for `super`-role allowlist entries (admin), not `storage` users. */
export function isSuperuser(email: string, list?: AllowlistEntry[]): boolean {
  return getAllowlistEntry(email, list)?.role === "super"
}
