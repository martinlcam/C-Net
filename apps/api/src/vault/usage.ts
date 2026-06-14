import { db } from "@cnet/db"
import { vaultFiles, vaultUploads } from "@cnet/db/schema"
import { eq, sql } from "drizzle-orm"

/** Bytes of completed files (includes trashed-but-unpurged: those rows still exist). */
export async function completedUsage(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${vaultFiles.size}), 0)` })
    .from(vaultFiles)
    .where(eq(vaultFiles.ownerUserId, userId))
  return Number(row?.total ?? 0)
}

/** Bytes reserved by in-flight uploads (expected sizes). */
export async function pendingUsage(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${vaultUploads.expectedSize}), 0)` })
    .from(vaultUploads)
    .where(eq(vaultUploads.ownerUserId, userId))
  return Number(row?.total ?? 0)
}

export async function wouldExceedQuota(
  userId: string,
  quotaBytes: number | null,
  addBytes: number
): Promise<boolean> {
  if (quotaBytes === null) return false
  const used = (await completedUsage(userId)) + (await pendingUsage(userId))
  return used + addBytes > quotaBytes
}
