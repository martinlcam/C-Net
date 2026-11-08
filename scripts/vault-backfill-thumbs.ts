/**
 * scripts/vault-backfill-thumbs.ts
 *
 * One-shot backfill: enqueue thumbnail (and, for Office docs, render-PDF) generation
 * for existing vault files that don't have a thumbnail yet but whose type is now
 * server-supported. Thumbnails are otherwise produced only at upload time, so files
 * uploaded before a type gained support never got one.
 *
 * Run from the repo root, against the same DATABASE_URL / Redis the workers use:
 *
 *     bun run scripts/vault-backfill-thumbs.ts          # enqueue
 *     bun run scripts/vault-backfill-thumbs.ts --dry    # report only, enqueue nothing
 *     bun run scripts/vault-backfill-thumbs.ts --force --path "2026-11-06 marty party"
 *         # regenerate thumbnails that already exist, for files in folders under that path
 *
 * Requires the workers to be running (with LibreOffice/libheif/poppler/ffmpeg) to
 * actually process the jobs.
 */

import { classifyFile, getVaultThumbnailsQueue, isServerThumbClass } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles } from "@cnet/db/schema"
import { and, eq, isNull, like, type SQL } from "drizzle-orm"

const dryRun = process.argv.includes("--dry")
// --force re-enqueues files that already have a thumbnail (e.g. after a generator fix);
// --path <prefix> limits the run to files in folders whose path starts with the prefix.
const force = process.argv.includes("--force")
const pathArg = process.argv.indexOf("--path")
const pathPrefix = pathArg >= 0 ? process.argv[pathArg + 1] : null

function conditions(): SQL[] {
  const where: SQL[] = [isNull(vaultFiles.deletedAt)]
  if (!force) where.push(isNull(vaultFiles.thumbKey))
  if (pathPrefix) {
    // LIKE wildcards in a folder name must match literally.
    const literal = pathPrefix.replace(/[\\%_]/g, (c) => `\\${c}`)
    where.push(like(vaultDirectories.path, `${literal}%`))
  }
  return where
}

async function main(): Promise<void> {
  const files = await db
    .select({
      id: vaultFiles.id,
      ownerUserId: vaultFiles.ownerUserId,
      filename: vaultFiles.filename,
      contentType: vaultFiles.contentType,
    })
    .from(vaultFiles)
    .leftJoin(vaultDirectories, eq(vaultDirectories.id, vaultFiles.directoryId))
    .where(and(...conditions()))

  const targets = files.filter((f) => isServerThumbClass(classifyFile(f.contentType, f.filename)))

  const byClass = new Map<string, number>()
  for (const f of targets) {
    const c = classifyFile(f.contentType, f.filename)
    byClass.set(c, (byClass.get(c) ?? 0) + 1)
  }
  console.log(
    `${files.length} files ${force ? "selected" : "without a thumbnail"}; ${targets.length} are server-supported:`,
    Object.fromEntries(byClass)
  )

  if (dryRun) {
    console.log("--dry: nothing enqueued.")
    return
  }

  const queue = getVaultThumbnailsQueue()
  for (const f of targets) {
    await queue.add("thumbnail", {
      userId: f.ownerUserId,
      fileId: f.id,
      contentType: f.contentType,
    })
  }
  console.log(`Enqueued ${targets.length} thumbnail jobs.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
