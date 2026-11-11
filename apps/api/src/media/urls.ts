import { signDownload, vaultSigningSecret } from "@cnet/core"

// Long-ish TTL so a signed stream URL survives watching a full movie.
const TTL_MS = 6 * 60 * 60 * 1000

export type MediaUrls = {
  streamUrl: string
  hlsUrl: string
  posterUrl: string
  backdropUrl: string
}

const WINDOWS_FORBIDDEN = /[\\/:*?"<>|]/g

function isControlChar(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code < 0x20 || code === 0x7f
}

/** Make a title safe as a filename on Windows, macOS and Linux alike. */
export function safeFilename(name: string): string {
  const printable = Array.from(name.replace(WINDOWS_FORBIDDEN, ""))
    .filter((ch) => !isControlChar(ch))
    .join("")
  const cleaned = printable
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
  return cleaned.slice(0, 180)
}

type DownloadNameItem = {
  Id: string
  Name: string
  Type?: string
  ProductionYear?: number
  SeriesName?: string
  IndexNumber?: number
  ParentIndexNumber?: number
  Path?: string
  MediaSources?: Array<{ Container?: string; Path?: string }>
}

function fileExtension(item: DownloadNameItem): string {
  const source = item.MediaSources?.[0]
  const fromPath = /\.([a-z0-9]{2,5})$/i.exec(item.Path ?? source?.Path ?? "")?.[1]
  // Jellyfin reports MP4-family containers as a list ("mov,mp4,m4a,..."), so the
  // path's own extension is the better source; the container is only a fallback.
  const container = source?.Container?.split(",")[0]
  return (fromPath ?? container ?? "mkv").toLowerCase()
}

/** "Show - S01E08 - Title.mkv" for episodes, "Title (2025).mkv" for everything else. */
export function downloadFilename(item: DownloadNameItem): string {
  const two = (n: number) => String(n).padStart(2, "0")
  const isEpisode = item.Type === "Episode" || (item.SeriesName != null && item.IndexNumber != null)
  const base =
    isEpisode && item.SeriesName
      ? [
          item.SeriesName,
          item.ParentIndexNumber != null && item.IndexNumber != null
            ? `S${two(item.ParentIndexNumber)}E${two(item.IndexNumber)}`
            : null,
          item.Name,
        ]
          .filter(Boolean)
          .join(" - ")
      : item.ProductionYear
        ? `${item.Name} (${item.ProductionYear})`
        : item.Name
  return `${safeFilename(base) || item.Id}.${fileExtension(item)}`
}

// A download of a big remux over a home uplink can take hours; the signature only
// has to be valid when each (possibly resumed) request starts.
const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Signed URL for saving an item's original file. Signed as an "attachment" so it
 * cannot be swapped for the inline stream/image URLs (and vice versa). The filename
 * rides along unsigned: it only labels the saved file and is re-sanitised on use.
 */
export function signMediaDownloadUrl(
  userId: string,
  itemId: string,
  filename: string,
  nowMs = Date.now()
): string {
  const exp = nowMs + DOWNLOAD_TTL_MS
  const sig = signDownload(
    { userId, fileId: itemId, exp, disposition: "attachment" },
    vaultSigningSecret()
  )
  return `/media/download/${userId}/${itemId}?exp=${exp}&sig=${sig}&name=${encodeURIComponent(filename)}`
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
    hlsUrl: `/media/hls/${userId}/${itemId}?${qs}`,
    posterUrl: `/media/img/${userId}/${itemId}?${qs}&type=Primary`,
    backdropUrl: `/media/img/${userId}/${itemId}?${qs}&type=Backdrop`,
  }
}
