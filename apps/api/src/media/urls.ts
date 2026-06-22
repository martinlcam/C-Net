import { signDownload, vaultSigningSecret } from "@cnet/core"

// Long-ish TTL so a signed stream URL survives watching a full movie.
const TTL_MS = 6 * 60 * 60 * 1000

export type MediaUrls = {
  streamUrl: string
  posterUrl: string
  backdropUrl: string
}

/**
 * Build short-lived signed URLs for a Jellyfin item, reusing the vault download
 * signing scheme (itemId stands in for fileId). The raw stream/image routes in
 * media/stream.ts verify the same signature — the Jellyfin host/admin-key is
 * never exposed to the browser.
 */
export function signMediaUrls(userId: string, itemId: string, nowMs = Date.now()): MediaUrls {
  const exp = nowMs + TTL_MS
  const sig = signDownload(
    { userId, fileId: itemId, exp, disposition: "inline" },
    vaultSigningSecret()
  )
  const qs = `exp=${exp}&sig=${sig}`
  return {
    streamUrl: `/media/stream/${userId}/${itemId}?${qs}`,
    posterUrl: `/media/img/${userId}/${itemId}?${qs}&type=Primary`,
    backdropUrl: `/media/img/${userId}/${itemId}?${qs}&type=Backdrop`,
  }
}
