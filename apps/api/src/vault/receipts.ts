import { db } from "@cnet/db"
import { vaultUploads } from "@cnet/db/schema"
import { eq, sql } from "drizzle-orm"

/**
 * Record that chunk `index` of an upload session has been written. One atomic statement:
 * the index is added only if absent and progress is derived from the distinct count, so
 * concurrent chunks cannot lose each other's updates. Returns the session's receipts after
 * the update, or null when the session no longer exists (finalized or reaped meanwhile).
 */
export async function recordChunkReceipt(id: string, index: number): Promise<number[] | null> {
  const merged = sql`(select array_agg(distinct i order by i) from unnest(array_append(${vaultUploads.receivedChunks}, ${index}::int)) as i)`
  const [row] = await db
    .update(vaultUploads)
    .set({
      receivedChunks: merged,
      uploadedBytes: sql`least(${vaultUploads.expectedSize}, cardinality(${merged}) * ${vaultUploads.chunkSize})`,
      lastChunkAt: new Date(),
    })
    .where(eq(vaultUploads.id, id))
    .returning({ receivedChunks: vaultUploads.receivedChunks })
  return row ? row.receivedChunks : null
}
