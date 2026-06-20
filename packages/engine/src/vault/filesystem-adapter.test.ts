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
  it("appends chunks, finalizes, reads back", async () => {
    await adapter.appendChunk("u1", "f1", 0, Buffer.from("hello "))
    await adapter.appendChunk("u1", "f1", 1, Buffer.from("world"))
    await adapter.finalize("u1", "f1")
    expect(await adapter.size("u1", "f1")).toBe(11)
    const bytes = await readFile(adapter.resolvePath("u1", "f1"))
    expect(bytes.toString()).toBe("hello world")
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
