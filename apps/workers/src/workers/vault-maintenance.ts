import { getRedisConnectionOptions, QUEUE_NAMES } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles, vaultUploads } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import { type Job, Worker } from "bullmq"
import { and, isNotNull, lt, or, sql } from "drizzle-orm"

interface MaintenanceJobData {
  type: "purge-trash" | "reap-uploads"
}

/** A Date `msAgo` milliseconds before `now`. */
export function cutoffDate(now: number, msAgo: number): Date {
  return new Date(now - msAgo)
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

async function purgeTrash(): Promise<{ purgedFiles: number; purgedDirs: number }> {
  const ttlDays = Number(process.env.VAULT_TRASH_TTL_DAYS ?? "30")
  const cutoff = cutoffDate(Date.now(), ttlDays * DAY_MS)
  const adapter = getStorageAdapter()

  const files = await db
    .select()
    .from(vaultFiles)
    .where(and(isNotNull(vaultFiles.deletedAt), lt(vaultFiles.deletedAt, cutoff)))
  for (const f of files) {
    await adapter.remove(f.ownerUserId, f.id)
    await db.delete(vaultFiles).where(sql`${vaultFiles.id} = ${f.id}`)
  }

  const dirs = await db
    .delete(vaultDirectories)
    .where(and(isNotNull(vaultDirectories.deletedAt), lt(vaultDirectories.deletedAt, cutoff)))
    .returning()

  return { purgedFiles: files.length, purgedDirs: dirs.length }
}

async function reapUploads(): Promise<{ reaped: number }> {
  const ttlHours = Number(process.env.VAULT_UPLOAD_TTL_HOURS ?? "24")
  const cutoff = cutoffDate(Date.now(), ttlHours * HOUR_MS)
  const adapter = getStorageAdapter()

  const stale = await db
    .select()
    .from(vaultUploads)
    .where(
      or(
        lt(vaultUploads.lastChunkAt, cutoff),
        and(sql`${vaultUploads.lastChunkAt} is null`, lt(vaultUploads.createdAt, cutoff))
      )
    )
  for (const u of stale) {
    await adapter.remove(u.ownerUserId, u.id) // clears the orphaned .part
    await db.delete(vaultUploads).where(sql`${vaultUploads.id} = ${u.id}`)
  }
  return { reaped: stale.length }
}

/* Trash purge + abandoned-upload reaper. */
export function createVaultMaintenanceWorker(): Worker {
  const worker = new Worker<MaintenanceJobData>(
    QUEUE_NAMES.VAULT_MAINTENANCE,
    async (job: Job<MaintenanceJobData>) => {
      if (job.data.type === "purge-trash") return purgeTrash()
      return reapUploads()
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
      removeOnFail: { age: 30 * 24 * 3600 },
    }
  )

  worker.on("failed", (job, err) => {
    console.error(`Vault maintenance job ${job?.id} (${job?.data.type}) failed:`, err)
  })

  return worker
}
