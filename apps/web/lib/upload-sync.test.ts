import { describe, expect, it } from "bun:test"
import { classify, type ExistingFile, type LocalFile, type OpenSession } from "./upload-sync"

const local = (over: Partial<LocalFile> = {}): LocalFile => ({
  name: "clip.mp4",
  size: 1000,
  mtimeMs: Date.UTC(2025, 0, 12, 14, 2, 20, 0),
  ...over,
})
const existing = (over: Partial<ExistingFile> = {}): ExistingFile => ({
  id: "f1",
  name: "clip.mp4",
  size: 1000,
  sourceModifiedAt: "2025-01-12T14:02:20.000Z",
  ...over,
})
const session = (over: Partial<OpenSession> = {}): OpenSession => ({
  id: "s1",
  filename: "clip.mp4",
  expectedSize: 1000,
  sourceModifiedAt: "2025-01-12T14:02:20.000Z",
  chunkSize: 400,
  chunkCount: 3,
  receivedChunks: [0, 2],
  ...over,
})

describe("classify", () => {
  it("skips a file whose name, size and modified time already match", () => {
    expect(classify(local(), [existing()], [])).toEqual({ kind: "skip" })
  })

  it("compares modified time to the second, like rclone's default window", () => {
    const sameSecond = local({ mtimeMs: Date.UTC(2025, 0, 12, 14, 2, 20, 900) })
    expect(classify(sameSecond, [existing()], [])).toEqual({ kind: "skip" })
  })

  it("resumes an open session with the same name, size and modified time", () => {
    const s = session()
    expect(classify(local(), [], [s])).toEqual({ kind: "resume", session: s })
  })

  it("resumes and carries the replace target when a changed old file is also present", () => {
    const s = session()
    const changed = existing({ size: 999 })
    expect(classify(local(), [changed], [s])).toEqual({
      kind: "resume",
      session: s,
      replaceFileId: "f1",
    })
  })

  it("skips rather than resumes when the live file already matches exactly", () => {
    expect(classify(local(), [existing()], [session()])).toEqual({ kind: "skip" })
  })

  it("replaces a same-name file whose size differs", () => {
    expect(classify(local(), [existing({ size: 999 })], [])).toEqual({
      kind: "replace",
      fileId: "f1",
    })
  })

  it("replaces a same-name file whose modified time differs", () => {
    expect(
      classify(local(), [existing({ sourceModifiedAt: "2024-12-01T00:00:00.000Z" })], [])
    ).toEqual({
      kind: "replace",
      fileId: "f1",
    })
  })

  it("falls back to size-only when the remote has no modified time, like rclone", () => {
    expect(classify(local(), [existing({ sourceModifiedAt: null })], [])).toEqual({ kind: "skip" })
    expect(classify(local(), [existing({ sourceModifiedAt: null, size: 999 })], [])).toEqual({
      kind: "replace",
      fileId: "f1",
    })
  })

  it("uploads fresh when nothing matches by name", () => {
    expect(
      classify(local(), [existing({ name: "other.mp4" })], [session({ filename: "x" })])
    ).toEqual({
      kind: "new",
    })
  })

  it("ignores a session whose size does not match the local file", () => {
    expect(classify(local(), [], [session({ expectedSize: 5 })])).toEqual({ kind: "new" })
  })
})
