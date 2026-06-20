import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { heicToPng, officeToPdf } from "./convert"

// These exercise the tolerant failure path: garbage input (and/or missing tooling) must
// resolve to null rather than throw, so the worker can skip cleanly.

let dir: string
let garbage: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "convert-test-"))
  garbage = join(dir, "src")
  await writeFile(garbage, Buffer.from("not a real document"))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("officeToPdf", () => {
  it("returns null for an invalid document (or missing soffice)", async () => {
    expect(await officeToPdf(garbage, ".docx")).toBeNull()
  })
})

describe("heicToPng", () => {
  it("returns null for an invalid image (or missing heif-convert)", async () => {
    expect(await heicToPng(garbage)).toBeNull()
  })
})
