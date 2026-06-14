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
      const { userId, fileId, contentType } = job.data

      const kind = pickGenerator(contentType)
      if (!kind) return { skipped: "unsupported" }

      const file = await db.query.vaultFiles.findFirst({
        where: and(
          eq(vaultFiles.id, fileId),
          eq(vaultFiles.ownerUserId, userId),
          isNull(vaultFiles.deletedAt)
        ),
      })
      if (!file) return { skipped: "missing" }

      const adapter = getStorageAdapter()
      const buf = await generateThumbnail(adapter.resolvePath(userId, fileId), kind)
      if (!buf) return { skipped: "no-thumbnail" }

      await adapter.writeThumb(userId, fileId, buf)
      await db
        .update(vaultFiles)
        .set({ thumbKey: `${fileId}.webp`, updatedAt: new Date() })
        .where(eq(vaultFiles.id, fileId))
      return { thumb: `${fileId}.webp` }
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
