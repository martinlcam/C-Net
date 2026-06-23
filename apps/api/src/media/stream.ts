import { vaultSigningSecret, verifyDownload, verifyToken } from "@cnet/core"
import type { Express, Request, Response } from "express"
import { extractToken } from "../middleware/auth.middleware"
import { getJellyfin } from "./clients"

/** Validate a signed media request (itemId stands in for the vault fileId). */
function verify(req: Request): { userId: string; itemId: string } | null {
  const userId = String(req.params.userId)
  const itemId = String(req.params.itemId)
  const exp = Number(req.query.exp)
  const sig = String(req.query.sig ?? "")
  if (!Number.isFinite(exp)) return null
  const { ok } = verifyDownload(
    { userId, fileId: itemId, exp, disposition: "inline", sig },
    vaultSigningSecret(),
    Date.now()
  )
  if (!ok) return null

  // Bind the signed URL to the requester's live session: a leaked URL is useless
  // without the owner's NextAuth cookie. Same-origin (martin.cam + /svc/*) means
  // the browser attaches the cookie automatically on img/video requests.
  const token = extractToken(req)
  if (!token) return null
  try {
    if (verifyToken(token).id !== userId) return null
  } catch {
    return null
  }

  return { userId, itemId }
}

// Bun's fetch/axios drain the whole upstream with no backpressure, so an open-ended
// stream of a multi-GB file OOMs CT110. Serving bounded Range windows keeps per-request
// memory tiny; the browser's <video> element requests subsequent windows as it plays.
const WINDOW_BYTES = 8 * 1024 * 1024

// HLS: copy H.264 video, transcode audio→AAC (browser-playable), deliver text subs as
// selectable renditions. Keeps memory bounded (segments are small on-demand GETs).
// videoBitRate/maxHeight matter when the source must be transcoded (e.g. HEVC): without
// a target, Jellyfin defaults to a tiny 416x234 rendition (badly degraded). 20 Mbps sits
// above our 1080p H.264 sources so those still copy untouched, while any real transcode
// targets full 1080p. (4K HEVC HDR still can't transcode in realtime on this CPU — those
// files should be re-grabbed as 1080p H.264; this just stops the picture being 240p.)
const HLS_PARAMS =
  "videoCodec=h264&audioCodec=aac&audioChannels=2&segmentContainer=ts&SubtitleMethod=Hls&videoBitRate=20000000&maxHeight=1080"

function whenDrained(res: Response): Promise<void> {
  return new Promise((resolve) => res.once("drain", resolve))
}

/** Pump a web ReadableStream to the response with explicit per-chunk backpressure. */
async function pump(body: ReadableStream<Uint8Array>, res: Response): Promise<void> {
  const reader = body.getReader()
  res.on("close", () => reader.cancel().catch(() => {}))
  while (!res.writableEnded) {
    const { done, value } = await reader.read()
    if (done) break
    if (!res.write(value)) await whenDrained(res)
  }
  if (!res.writableEnded) res.end()
}

/** Strip Jellyfin's api key from a URL (we auth upstream via header instead).
 * Case-insensitive + both spellings: master/variant use `api_key`, subtitle and
 * .vtt URIs use `ApiKey` — missing the latter leaked the admin key to the browser. */
function stripKey(url: string): string {
  return url.replace(/([?&])api_?key=[^&]*/gi, "$1").replace(/[?&]+$/, "")
}

/** Directory portion of a playlist path (everything up to and including the last "/"). */
function dirOf(relPath: string): string {
  const p = stripKey(relPath).split("?")[0]
  const i = p.lastIndexOf("/")
  return i >= 0 ? p.slice(0, i + 1) : ""
}

/**
 * Rewrite an HLS playlist so every child URL flows back through this signed proxy.
 * `baseDir` is the playlist's own directory relative to `Videos/{itemId}/`; child
 * URIs are resolved against it so deep renditions keep their full path — without
 * this, subtitle `.vtt` segments under `{itemId}/Subtitles/N/` resolved to the
 * wrong location and 404'd (subtitles never rendered).
 */
function rewritePlaylist(text: string, exp: string, sig: string, baseDir: string): string {
  // Query-only relative URL: the browser resolves it against the current
  // playlist URL (same /media/hls/:user/:item endpoint), so it works regardless
  // of any edge path prefix (e.g. /svc) the playlist was fetched through.
  const proxify = (uri: string) => {
    const clean = stripKey(uri)
    const full = clean.startsWith("/") || /^https?:/i.test(clean) ? clean : baseDir + clean
    return `?path=${encodeURIComponent(full)}&exp=${exp}&sig=${sig}`
  }
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim()
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${proxify(u)}"`)
      }
      if (t === "") return line
      return proxify(t)
    })
    .join("\n")
}

export function registerMediaStream(app: Express): void {
  app.get("/media/img/:userId/:itemId", async (req: Request, res: Response) => {
    const v = verify(req)
    if (!v) {
      res.status(403).end()
      return
    }
    const type = String(req.query.type ?? "Primary")
    try {
      const upstream = await getJellyfin().imageStream(v.itemId, type)
      res.setHeader("Content-Type", String(upstream.headers["content-type"] ?? "image/jpeg"))
      res.setHeader("Cache-Control", "private, max-age=86400")
      upstream.data.pipe(res)
    } catch {
      res.status(404).end()
    }
  })

  // Direct-play (windowed) — kept for already-compatible files / downloads.
  app.get("/media/stream/:userId/:itemId", async (req: Request, res: Response) => {
    const v = verify(req)
    if (!v) {
      res.status(403).end()
      return
    }
    const ac = new AbortController()
    res.on("close", () => ac.abort())
    try {
      let start = 0
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "")
      if (m) start = Number.parseInt(m[1], 10)
      const reqEnd = m?.[2] ? Number.parseInt(m[2], 10) : Number.POSITIVE_INFINITY
      const end = Math.min(start + WINDOW_BYTES - 1, reqEnd)
      const upstream = await getJellyfin().videoFetch(v.itemId, `bytes=${start}-${end}`, ac.signal)
      if (upstream.status === 416) {
        res.status(416).end()
        return
      }
      res.status(206)
      res.setHeader("Accept-Ranges", "bytes")
      for (const h of ["content-type", "content-range", "content-length"]) {
        const val = upstream.headers.get(h)
        if (val) res.setHeader(h, val)
      }
      if (upstream.body) await pump(upstream.body, res)
      else res.end()
    } catch (err) {
      if (!res.headersSent && !ac.signal.aborted) res.status(502).end()
      else if (!res.writableEnded) res.end()
    }
  })

  // HLS transcoding proxy: master/variant playlists are rewritten; segments are streamed.
  app.get("/media/hls/:userId/:itemId", async (req: Request, res: Response) => {
    const v = verify(req)
    if (!v) {
      res.status(403).end()
      return
    }
    const exp = String(req.query.exp ?? "")
    const sig = String(req.query.sig ?? "")
    const pathParam = typeof req.query.path === "string" ? req.query.path : ""

    let relpath: string
    if (!pathParam) {
      relpath = `Videos/${v.itemId}/master.m3u8?mediaSourceId=${v.itemId}&deviceId=cnet-${v.userId}&${HLS_PARAMS}`
    } else if (pathParam.includes("..") || pathParam.startsWith("/") || /^https?:/i.test(pathParam)) {
      res.status(400).end()
      return
    } else {
      relpath = `Videos/${v.itemId}/${stripKey(pathParam)}`
    }

    const ac = new AbortController()
    res.on("close", () => ac.abort())
    try {
      const upstream = await getJellyfin().streamFetch(relpath, ac.signal)
      if (upstream.status >= 400) {
        res.status(upstream.status).end()
        return
      }
      if (relpath.includes(".m3u8")) {
        const text = await upstream.text()
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl")
        res.setHeader("Cache-Control", "no-store")
        // baseDir = this playlist's own directory relative to Videos/{itemId}/.
        res.end(rewritePlaylist(text, exp, sig, pathParam ? dirOf(pathParam) : ""))
      } else {
        const ct = upstream.headers.get("content-type")
        if (ct) res.setHeader("Content-Type", ct)
        if (upstream.body) await pump(upstream.body, res)
        else res.end()
      }
    } catch (err) {
      if (!res.headersSent && !ac.signal.aborted) res.status(502).end()
      else if (!res.writableEnded) res.end()
    }
  })
}
