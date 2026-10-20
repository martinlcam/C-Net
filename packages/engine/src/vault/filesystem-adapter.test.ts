import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FilesystemAdapter } from "./filesystem-adapter"

let root: string
let adapter: FilesystemAdapter

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "vault-"))
  adapter = new FilesystemAdapter(root)
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("FilesystemAdapter", () => {
  it("writes chunks by offset, out of order, idempotently", async () => {
    await adapter.writeChunk("u1", "f1", 6, Buffer.from("world"))
    await adapter.writeChunk("u1", "f1", 0, Buffer.from("hello "))
    await adapter.writeChunk("u1", "f1", 6, Buffer.from("world")) // duplicate
    expect(await adapter.partSize("u1", "f1")).toBe(11)
    await adapter.finalize("u1", "f1")
    expect(await adapter.partSize("u1", "f1")).toBeNull()
    expect(await adapter.size("u1", "f1")).toBe(11)
    const bytes = await readFile(adapter.resolvePath("u1", "f1"))
    expect(bytes.toString()).toBe("hello world")
  })
  it("keeps every chunk when six first chunks of a new file land at once", async () => {
    // Regression for a create-if-missing race: a late creator must not truncate what
    // earlier concurrent writers already put in the part file.
    const chunk = 256 * 1024
    const parts = Array.from({ length: 6 }, (_, i) => Buffer.alloc(chunk, 65 + i))
    for (let run = 0; run < 20; run++) {
      const id = `race-${run}`
      await Promise.all(parts.map((b, i) => adapter.writeChunk("u1", id, i * chunk, b)))
      await adapter.finalize("u1", id)
      const bytes = await readFile(adapter.resolvePath("u1", id))
      expect(bytes.length).toBe(chunk * 6)
      for (let i = 0; i < 6; i++) {
        expect(bytes[i * chunk]).toBe(65 + i)
        expect(bytes[(i + 1) * chunk - 1]).toBe(65 + i)
      }
    }
  })
  it("serves a byte range", async () => {
    const chunks: Buffer[] = []
    const stream = adapter.createReadStream("u1", "f1", { start: 0, end: 4 })
    for await (const c of stream) chunks.push(c as Buffer)
    expect(Buffer.concat(chunks).toString()).toBe("hello")
  })
  it("writes a thumbnail", async () => {
    await adapter.writeThumb("u1", "f1", Buffer.from("thumb"))
    const bytes = await readFile(join(root, "cnet", "users", "u1", ".thumbs", "f1.webp"))
    expect(bytes.toString()).toBe("thumb")
  })
  it("writes and serves a rendered PDF", async () => {
    expect(await adapter.renderedPdfSize("u1", "f1")).toBeNull()
    await adapter.writePdf("u1", "f1", Buffer.from("%PDF-1.7"))
    expect(await adapter.renderedPdfSize("u1", "f1")).toBe(8)
    const chunks: Buffer[] = []
    for await (const c of adapter.renderedPdfStream("u1", "f1")) chunks.push(c as Buffer)
    expect(Buffer.concat(chunks).toString()).toBe("%PDF-1.7")
  })
  it("removes a file and its derivatives", async () => {
    await adapter.remove("u1", "f1")
    await expect(adapter.size("u1", "f1")).rejects.toThrow()
    expect(await adapter.renderedPdfSize("u1", "f1")).toBeNull()
    expect(await adapter.thumbSize("u1", "f1")).toBeNull()
  })
})
