import { type Disposition, signDownload, vaultSigningSecret } from "@cnet/core"

const TTL_MS = 24 * 60 * 60 * 1000

export type SignedUrls = { previewUrl: string; downloadUrl: string; thumbUrl: string }

/** Build short-lived signed inline + attachment + thumbnail URLs for a file. */
export function signedUrlsFor(userId: string, fileId: string, nowMs: number): SignedUrls {
  const secret = vaultSigningSecret()
  const exp = nowMs + TTL_MS
  const mk = (base: string, disposition: Disposition) => {
    const sig = signDownload({ userId, fileId, exp, disposition }, secret)
    return `${base}/${userId}/${fileId}?exp=${exp}&disp=${disposition}&sig=${sig}`
  }
  return {
    previewUrl: mk("/vault/dl", "inline"),
    downloadUrl: mk("/vault/dl", "attachment"),
    // Reuses the inline signature; the /vault/thumb route serves the .webp derivative.
    thumbUrl: mk("/vault/thumb", "inline"),
  }
}
