import { type Disposition, signDownload, vaultSigningSecret } from "@cnet/core"

const TTL_MS = 15 * 60 * 1000

export type SignedUrls = {
  previewUrl: string
  downloadUrl: string
  thumbUrl: string
  renderedPdfUrl: string
}

/** Build short-lived signed inline + attachment + thumbnail + rendered-PDF URLs. */
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
    // Both reuse the inline signature; the routes serve the derivatives by file id.
    thumbUrl: mk("/vault/thumb", "inline"),
    renderedPdfUrl: mk("/vault/rendered", "inline"),
  }
}
