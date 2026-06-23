import { type Disposition, signDownload, vaultSigningSecret } from "@cnet/core"

// URLs are now bound to the requester's session (see vault/download.ts resolve()),
// so a leaked URL is useless without the owner's cookie regardless of TTL. The TTL
// is just a backstop now, kept long enough that a download click late in a browsing
// session doesn't 403 on a stale signature.
const TTL_MS = 6 * 60 * 60 * 1000

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
