/**
 * Constant-time string compare. Prevents trivial timing-attack distinguishers
 * on the BD_INGEST_KEY. The token is low-stakes (gates a public-readable EEG
 * stream from being polluted) but it's a one-liner to do right.
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export function ingestKey(): string {
  return process.env.BD_INGEST_KEY || "dev-insecure-key"
}
