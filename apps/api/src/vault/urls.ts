import { type Disposition, signDownload, vaultSigningSecret } from "@cnet/core"

const TTL_MS = 24 * 60 * 60 * 1000

export type SignedUrls = { previewUrl: string; downloadUrl: string }

/** Build short-lived signed inline + attachment URLs for a file. */
export function signedUrlsFor(userId: string, fileId: string, nowMs: number): SignedUrls {
  const secret = vaultSigningSecret()
  const exp = nowMs + TTL_MS
  const mk = (disposition: Disposition) => {
    const sig = signDownload({ userId, fileId, exp, disposition }, secret)
    return `/vault/dl/${userId}/${fileId}?exp=${exp}&disp=${disposition}&sig=${sig}`
  }
  return { previewUrl: mk("inline"), downloadUrl: mk("attachment") }
}
