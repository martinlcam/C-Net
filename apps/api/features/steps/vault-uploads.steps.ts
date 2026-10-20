import assert from "node:assert/strict"
import { readFile, truncate } from "node:fs/promises"
import { join } from "node:path"
import { db } from "@cnet/db"
import { vaultFiles } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import { Given, Then, When } from "@cucumber/cucumber"
import { eq } from "drizzle-orm"
import type { InviteWorld } from "../support/world"

type OpenResult = { uploadId: string; chunkSize: number; chunkCount: number }
type Progress = { receivedChunks: number[]; uploadedBytes: number; chunkCount: number }

const enc = new TextEncoder()
const MiB = 1024 * 1024

function quoted(list: string): string[] {
  return [...list.matchAll(/"([^"]*)"/g)].map((m) => m[1])
}

function storedPath(world: InviteWorld, suffix = ""): string {
  const root = process.env.TANK_MOUNT_PATH
  if (!root || !world.vaultUserId || !world.uploadId) throw new Error("no upload in progress")
  return join(root, "cnet", "users", world.vaultUserId, `${world.uploadId}${suffix}`)
}

Given("I am a vault user", async function (this: InviteWorld) {
  await this.signInAsVaultUser()
})

Given(
  "an upload session for {string} of {int} bytes in {int}-byte chunks",
  async function (this: InviteWorld, filename: string, size: number, chunk: number) {
    const res = await this.post("/vault/uploads", {
      directoryId: null,
      filename,
      contentType: "application/octet-stream",
      expectedSize: size,
      chunkSize: chunk,
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const body = res.body as OpenResult
    this.uploadId = body.uploadId
    this.uploadChunkSize = body.chunkSize
  }
)

When(
  "I open an upload session for {string} of {int} bytes with a {int} MiB chunk size",
  async function (this: InviteWorld, filename: string, size: number, mib: number) {
    await this.post("/vault/uploads", {
      directoryId: null,
      filename,
      contentType: "application/octet-stream",
      expectedSize: size,
      chunkSize: mib * MiB,
    })
  }
)

When(
  "I send chunk {int} with bytes {string}",
  async function (this: InviteWorld, index: number, bytes: string) {
    await this.putRaw(`/vault/uploads/${this.uploadId}/chunks/${index}`, enc.encode(bytes))
  }
)

When(
  /^I send chunks (.+) at the same time with bytes (.+)$/,
  async function (this: InviteWorld, indexes: string, bytesList: string) {
    const idx = indexes.match(/\d+/g)?.map(Number) ?? []
    const bodies = quoted(bytesList)
    assert.equal(idx.length, bodies.length)
    await Promise.all(
      idx.map((i, k) =>
        this.putRaw(`/vault/uploads/${this.uploadId}/chunks/${i}`, enc.encode(bodies[k]))
      )
    )
  }
)

When(
  "the part file on disk is truncated to {int} bytes",
  async function (this: InviteWorld, n: number) {
    await truncate(storedPath(this, ".part"), n)
  }
)

When("I finalize the upload", async function (this: InviteWorld) {
  await this.post(`/vault/uploads/${this.uploadId}/finalize`, {})
})

Then("the upload reports {int} received chunks", async function (this: InviteWorld, n: number) {
  const res = await this.get(`/vault/uploads/${this.uploadId}`)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal((res.body as Progress).receivedChunks.length, n)
})

Then("the stored file is exactly {string}", async function (this: InviteWorld, expected: string) {
  const bytes = await readFile(storedPath(this))
  assert.equal(bytes.toString(), expected)
})

Given(
  "an upload session for {string} of {int} bytes in {int}-byte chunks modified at {string}",
  async function (this: InviteWorld, filename: string, size: number, chunk: number, iso: string) {
    const res = await this.post("/vault/uploads", {
      directoryId: null,
      filename,
      contentType: "application/octet-stream",
      expectedSize: size,
      chunkSize: chunk,
      sourceModifiedAt: iso,
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const body = res.body as OpenResult
    this.uploadId = body.uploadId
    this.uploadChunkSize = body.chunkSize
  }
)

Then("the file's source modified time is {string}", function (this: InviteWorld, iso: string) {
  assert.equal((this.res.body as { sourceModifiedAt: string | null }).sourceModifiedAt, iso)
})

type SessionDto = { id: string; filename: string; receivedChunks: number[] }

When("I list upload sessions in the root", async function (this: InviteWorld) {
  await this.get("/vault/uploads")
})

Then(
  "the list has one session for {string} with received chunks {int}",
  function (this: InviteWorld, filename: string, chunk: number) {
    const list = this.res.body as SessionDto[]
    assert.equal(list.length, 1, JSON.stringify(list))
    assert.equal(list[0].filename, filename)
    assert.equal(list[0].id, this.uploadId)
    assert.deepEqual(list[0].receivedChunks, [chunk])
  }
)

Given(
  "a vault file {string} of {int} bytes already exists in the root",
  async function (this: InviteWorld, filename: string, size: number) {
    if (!this.vaultUserId) throw new Error("sign in first")
    const id = crypto.randomUUID()
    const adapter = getStorageAdapter()
    await adapter.writeChunk(this.vaultUserId, id, 0, Buffer.alloc(size, "o"))
    await adapter.finalize(this.vaultUserId, id)
    await db.insert(vaultFiles).values({
      id,
      ownerUserId: this.vaultUserId,
      directoryId: null,
      filename,
      size,
      contentType: "application/octet-stream",
    })
    this.existingFileId = id
  }
)

When(
  "I finalize the upload replacing the existing {string}",
  async function (this: InviteWorld, _filename: string) {
    await this.post(`/vault/uploads/${this.uploadId}/finalize`, {
      replaceFileId: this.existingFileId,
    })
  }
)

When(
  "I finalize the upload replacing a file that does not exist",
  async function (this: InviteWorld) {
    await this.post(`/vault/uploads/${this.uploadId}/finalize`, {
      replaceFileId: crypto.randomUUID(),
    })
  }
)

Then("the new file is named {string}", function (this: InviteWorld, filename: string) {
  assert.equal((this.res.body as { filename: string }).filename, filename)
})

Then("the old {string} is in the trash", async function (this: InviteWorld, _filename: string) {
  if (!this.existingFileId) throw new Error("no existing file")
  const [row] = await db.select().from(vaultFiles).where(eq(vaultFiles.id, this.existingFileId))
  assert.ok(row, "old row still exists")
  assert.ok(row.deletedAt, "old file has deletedAt set")
  assert.equal(row.originalDirectoryId, null)
})
