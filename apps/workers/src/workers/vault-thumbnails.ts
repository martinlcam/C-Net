import { getRedisConnectionOptions, QUEUE_NAMES } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultFiles } from "@cnet/db/schema"
import { generateThumbnail, getStorageAdapter, pickGenerator } from "@cnet/engine"
import { type Job, Worker } from "bullmq"
import { and, eq, isNull } from "drizzle-orm"

interface ThumbnailJobData {
  userId: string
  fileId: string
  contentType: string
}

/* Generates a webp thumbnail for a finished upload and records thumbKey.
 * Unsupported types or missing tooling (pdftoppm/ffmpeg) are skipped, not failed.
 */
export function createVaultThumbnailsWorker(): Worker {
  const worker = new Worker<ThumbnailJobData>(
    QUEUE_NAMES.VAULT_THUMBNAILS,
    async (job: Job<ThumbnailJobData>) => {
      const { userId, fileId } = job.data

      const file = await db.query.vaultFiles.findFirst({
        where: and(
          eq(vaultFiles.id, fileId),
          eq(vaultFiles.ownerUserId, userId),
          isNull(vaultFiles.deletedAt)
        ),
      })
      if (!file) return { skipped: "missing" }

      const kind = pickGenerator(file.contentType, file.filename)
      if (!kind) return { skipped: "unsupported" }

      const adapter = getStorageAdapter()
      const result = await generateThumbnail(
        adapter.resolvePath(userId, fileId),
        kind,
        file.filename
      )
      if (!result) return { skipped: "no-thumbnail" }

      // Office docs also yield a cached render PDF for fullscreen preview; persist it
      // alongside the thumbnail so thumbKey != null implies the PDF exists too.
      if (result.pdf) await adapter.writePdf(userId, fileId, result.pdf)
      await adapter.writeThumb(userId, fileId, result.thumb)
      await db
        .update(vaultFiles)
        .set({ thumbKey: `${fileId}.webp`, updatedAt: new Date() })
        .where(eq(vaultFiles.id, fileId))
      return { thumb: `${fileId}.webp`, pdf: result.pdf ? `${fileId}.pdf` : undefined }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
      removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
      removeOnFail: { age: 30 * 24 * 3600 },
    }
  )

  worker.on("failed", (job, err) => {
    console.error(`Vault thumbnail job ${job?.id} failed:`, err)
  })

  return worker
}
