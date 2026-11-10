import { uniqueZipNames, verifyToken } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultFiles } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import archiver from "archiver"
import { and, eq, inArray, isNull } from "drizzle-orm"
import express, { type Express, type Request, type Response } from "express"
import { extractToken } from "../middleware/auth.middleware"

const MAX_FILES = 5000

/**
 * POST /vault/zip — stream the caller's selected files as one zip. Submitted as a plain
 * form (not fetch) so the browser treats the response as a download, which is also why
 * auth is the session cookie rather than a signed URL. Entries are stored, not deflated:
 * photos and videos don't shrink, and storing keeps the box's CPU out of it.
 */
export function registerVaultZip(app: Express): void {
  app.post(
    "/vault/zip",
    express.urlencoded({ extended: false, limit: "1mb" }),
    async (req: Request, res: Response) => {
      const token = extractToken(req)
      let userId: string
      try {
        if (!token) throw new Error("no session")
        userId = verifyToken(token).id
      } catch {
        res.status(401).end()
        return
      }

      let ids: unknown
      try {
        ids = JSON.parse(String(req.body?.ids ?? "[]"))
      } catch {
        ids = null
      }
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_FILES) {
        res.status(400).end()
        return
      }
      const wanted = ids.filter((x): x is string => typeof x === "string")

      const files = await db.query.vaultFiles.findMany({
        where: and(
          inArray(vaultFiles.id, wanted),
          eq(vaultFiles.ownerUserId, userId),
          isNull(vaultFiles.deletedAt)
        ),
      })
      if (files.length === 0) {
        res.status(404).end()
        return
      }
      // Keep the caller's order so the archive reads like the selection did.
      const order = new Map(wanted.map((id, i) => [id, i]))
      files.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

      const base = String(req.body?.name ?? "files")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .trim()
        .slice(0, 80)
      const stamp = new Date().toISOString().slice(0, 10)
      const zipName = `${base || "files"} ${stamp}.zip`

      res.status(200)
      res.setHeader("Content-Type", "application/zip")
      res.setHeader("Content-Disposition", `attachment; filename="${zipName.replace(/"/g, "")}"`)
      res.setHeader("Cache-Control", "no-store")

      const archive = archiver("zip", { store: true })
      archive.on("warning", () => {})
      archive.on("error", () => {
        if (!res.headersSent) res.status(500)
        res.end()
      })
      // A closed tab must not keep reading gigabytes off the tank.
      res.on("close", () => {
        if (!res.writableFinished) archive.abort()
      })
      archive.pipe(res)

      const adapter = getStorageAdapter()
      const names = uniqueZipNames(files.map((f) => f.filename))
      files.forEach((f, i) => {
        archive.append(adapter.createReadStream(f.ownerUserId, f.id), {
          name: names[i],
          date: f.sourceModifiedAt ?? f.createdAt ?? undefined,
        })
      })
      await archive.finalize().catch(() => {})
    }
  )
}
