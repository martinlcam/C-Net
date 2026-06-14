import { createHmac, timingSafeEqual } from "node:crypto"

export type Disposition = "inline" | "attachment"

export type DownloadClaims = {
  userId: string
  fileId: string
  exp: number // epoch ms
  disposition: Disposition
}

function canonical(c: DownloadClaims): string {
  return `${c.userId}.${c.fileId}.${c.exp}.${c.disposition}`
}

export function signDownload(claims: DownloadClaims, secret: string): string {
  return createHmac("sha256", secret).update(canonical(claims)).digest("hex")
}

export function verifyDownload(
  input: DownloadClaims & { sig: string },
  secret: string,
  nowMs: number
): { ok: boolean } {
  const expected = signDownload(input, secret)
  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(input.sig, "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false }
  if (input.exp < nowMs) return { ok: false }
  return { ok: true }
}

export function vaultSigningSecret(): string {
  const secret =
    process.env.VAULT_SIGNING_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("VAULT_SIGNING_SECRET or AUTH_SECRET must be set")
  return secret
}
