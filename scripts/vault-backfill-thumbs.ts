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
 *
 * Requires the workers to be running (with LibreOffice/libheif/poppler/ffmpeg) to
 * actually process the jobs.
 */

import { classifyFile, getVaultThumbnailsQueue, isServerThumbClass } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultFiles } from "@cnet/db/schema"
import { and, isNull } from "drizzle-orm"

const dryRun = process.argv.includes("--dry")

async function main(): Promise<void> {
  const files = await db
    .select({
      id: vaultFiles.id,
      ownerUserId: vaultFiles.ownerUserId,
      filename: vaultFiles.filename,
      contentType: vaultFiles.contentType,
    })
    .from(vaultFiles)
    .where(and(isNull(vaultFiles.deletedAt), isNull(vaultFiles.thumbKey)))

  const targets = files.filter((f) => isServerThumbClass(classifyFile(f.contentType, f.filename)))

  const byClass = new Map<string, number>()
  for (const f of targets) {
    const c = classifyFile(f.contentType, f.filename)
    byClass.set(c, (byClass.get(c) ?? 0) + 1)
  }
  console.log(
    `${files.length} files without a thumbnail; ${targets.length} are server-supported:`,
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
