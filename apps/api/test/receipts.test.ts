import "@cnet/core/env"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { db } from "@cnet/db"
import { users, vaultUploads } from "@cnet/db/schema"
import { eq } from "drizzle-orm"
import { recordChunkReceipt } from "../src/vault/receipts"

// Needs the local database (bun run db:start && bun run db:migrate), like the BDD suite.
let userId: string
let uploadId: string

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({ email: "receipts@bdd.local", name: "Receipts" })
    .onConflictDoUpdate({ target: users.email, set: { name: "Receipts" } })
    .returning({ id: users.id })
  userId = u.id
  const [row] = await db
    .insert(vaultUploads)
    .values({
      ownerUserId: userId,
      filename: "r.bin",
      contentType: "application/octet-stream",
      expectedSize: 10,
      chunkSize: 4,
      chunkCount: 3,
    })
    .returning({ id: vaultUploads.id })
  uploadId = row.id
})
afterAll(async () => {
  await db.delete(vaultUploads).where(eq(vaultUploads.ownerUserId, userId))
})

describe("recordChunkReceipt", () => {
  it("adds the index once and reports the distinct sorted receipts", async () => {
    expect(await recordChunkReceipt(uploadId, 2)).toEqual([2])
    expect(await recordChunkReceipt(uploadId, 0)).toEqual([0, 2])
    expect(await recordChunkReceipt(uploadId, 2)).toEqual([0, 2])
  })
  it("returns null when the session no longer exists", async () => {
    await db.delete(vaultUploads).where(eq(vaultUploads.id, uploadId))
    expect(await recordChunkReceipt(uploadId, 1)).toBeNull()
  })
})
