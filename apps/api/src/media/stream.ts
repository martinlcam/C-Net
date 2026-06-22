import { vaultSigningSecret, verifyDownload } from "@cnet/core"
import type { Express, Request, Response } from "express"
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
  return ok ? { userId, itemId } : null
}

const RELAY_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"]

/**
 * Raw signed routes that proxy Jellyfin artwork and video streams. Registered
 * before tsoa so they own these paths; auth is the URL signature, not a session.
 */
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

  app.get("/media/stream/:userId/:itemId", async (req: Request, res: Response) => {
    const v = verify(req)
    if (!v) {
      res.status(403).end()
      return
    }
    try {
      const upstream = await getJellyfin().videoStream(v.itemId, req.headers.range)
      res.status(upstream.status)
      for (const h of RELAY_HEADERS) {
        const val = upstream.headers[h]
        if (val) res.setHeader(h, String(val))
      }
      if (!upstream.headers["accept-ranges"]) res.setHeader("Accept-Ranges", "bytes")
      upstream.data.pipe(res)
      // Tear down the upstream socket if the client disconnects mid-stream.
      req.on("close", () => upstream.data.destroy())
    } catch {
      res.status(502).end()
    }
  })
}
