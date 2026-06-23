import { type Disposition, vaultSigningSecret, verifyDownload, verifyToken } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultFiles } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import { and, eq, isNull } from "drizzle-orm"
import type { Express, Request, Response } from "express"
import { extractToken } from "../middleware/auth.middleware"

type Resolved = {
  file: typeof vaultFiles.$inferSelect
  disposition: Disposition
}

/** Validate a signed download request and load the file, or null if unauthorized/missing. */
async function resolve(req: Request): Promise<Resolved | null> {
  const userId = String(req.params.userId)
  const fileId = String(req.params.fileId)
  const exp = Number(req.query.exp)
  const disposition = req.query.disp === "attachment" ? "attachment" : "inline"
  const sig = String(req.query.sig ?? "")
  if (!Number.isFinite(exp)) return null

  const { ok } = verifyDownload(
    { userId, fileId, exp, disposition, sig },
    vaultSigningSecret(),
    Date.now()
  )
  if (!ok) return null

  // Bind the signed URL to the requester's live session: a leaked URL is useless
  // without the owner's NextAuth cookie. Fail closed if the cookie is absent or
  // belongs to a different user. The browser attaches the cookie automatically on
  // same-origin <img>/<video>/<a>/fetch requests (web + API share the host).
  const token = extractToken(req)
  if (!token) return null
  try {
    if (verifyToken(token).id !== userId) return null
  } catch {
    return null
  }

  const file = await db.query.vaultFiles.findFirst({
    where: and(
      eq(vaultFiles.id, fileId),
      eq(vaultFiles.ownerUserId, userId),
      isNull(vaultFiles.deletedAt)
    ),
  })
  if (!file) return null
  return { file, disposition }
}

function dispositionHeader(disposition: Disposition, filename: string): string {
  const safe = filename.replace(/"/g, "")
  return `${disposition}; filename="${safe}"`
}

/** Parse a single-range "bytes=start-end" header against a known size. */
function parseRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | null {
  if (!header?.startsWith("bytes=")) return null
  const [startRaw, endRaw] = header.slice(6).split("-")
  const start = startRaw ? Number.parseInt(startRaw, 10) : 0
  let end = endRaw ? Number.parseInt(endRaw, 10) : size - 1
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) return null
  if (end >= size) end = size - 1
  return { start, end }
}

export function registerVaultDownload(app: Express): void {
  // Caddy forward_auth target: validate only, return 200 + headers, no body.
  app.get("/vault/_authz/:userId/:fileId", async (req: Request, res: Response) => {
    const resolved = await resolve(req)
    if (!resolved) {
      res.status(403).end()
      return
    }
    res.setHeader("Content-Type", resolved.file.contentType)
    res.setHeader(
      "Content-Disposition",
      dispositionHeader(resolved.disposition, resolved.file.filename)
    )
    res.status(200).end()
  })

  // Byte server (dev + prod source of truth). Auth is the signature, not a session.
  app.get("/vault/dl/:userId/:fileId", async (req: Request, res: Response) => {
    const resolved = await resolve(req)
    if (!resolved) {
      res.status(403).end()
      return
    }
    const { file, disposition } = resolved
    const adapter = getStorageAdapter()
    res.setHeader("Content-Type", file.contentType)
    res.setHeader("Content-Disposition", dispositionHeader(disposition, file.filename))
    res.setHeader("Accept-Ranges", "bytes")

    const range = parseRange(req.headers.range, file.size)
    if (range) {
      res.status(206)
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${file.size}`)
      res.setHeader("Content-Length", String(range.end - range.start + 1))
      adapter.createReadStream(file.ownerUserId, file.id, range).pipe(res)
      return
    }
    res.setHeader("Content-Length", String(file.size))
    adapter.createReadStream(file.ownerUserId, file.id).pipe(res)
  })

  // Thumbnail server: serves the generated .webp derivative (304-cacheable).
  // Authorized by the same inline signature as the file's previewUrl.
  app.get("/vault/thumb/:userId/:fileId", async (req: Request, res: Response) => {
    const resolved = await resolve(req)
    if (!resolved) {
      res.status(403).end()
      return
    }
    const { file } = resolved
    const adapter = getStorageAdapter()
    const size = await adapter.thumbSize(file.ownerUserId, file.id)
    if (size === null) {
      res.status(404).end() // no thumbnail generated yet
      return
    }
    res.setHeader("Content-Type", "image/webp")
    res.setHeader("Content-Length", String(size))
    res.setHeader("Cache-Control", "private, max-age=3600")
    adapter.thumbStream(file.ownerUserId, file.id).pipe(res)
  })

  // Rendered-PDF server for Office docs: serves the cached .renders/<id>.pdf derivative.
  // Authorized by the same inline signature; 404 until the worker has converted it.
  // Supports HEAD so the viewer can probe readiness without downloading the PDF.
  app.all("/vault/rendered/:userId/:fileId", async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).end()
      return
    }
    const resolved = await resolve(req)
    if (!resolved) {
      res.status(403).end()
      return
    }
    const { file } = resolved
    const adapter = getStorageAdapter()
    const size = await adapter.renderedPdfSize(file.ownerUserId, file.id)
    if (size === null) {
      res.status(404).end() // not converted yet
      return
    }
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Length", String(size))
    res.setHeader("Cache-Control", "private, max-age=3600")
    if (req.method === "HEAD") {
      res.status(200).end()
      return
    }
    adapter.renderedPdfStream(file.ownerUserId, file.id).pipe(res)
  })
}
