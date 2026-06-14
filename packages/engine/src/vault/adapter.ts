import type { ReadStream } from "node:fs"

export interface StorageAdapter {
  // chunked upload (id = vault_uploads.id, later vault_files.id)
  appendChunk(userId: string, id: string, index: number, body: Buffer): Promise<void>
  finalize(userId: string, id: string): Promise<void> // <id>.part -> <id>
  remove(userId: string, id: string): Promise<void> // file or orphaned .part
  writeThumb(userId: string, id: string, body: Buffer): Promise<void>
  // delivery
  resolvePath(userId: string, id: string): string
  createReadStream(userId: string, id: string, range?: { start: number; end: number }): ReadStream
  size(userId: string, id: string): Promise<number>
  // thumbnail delivery (thumbSize returns null when no thumbnail exists yet)
  thumbStream(userId: string, id: string): ReadStream
  thumbSize(userId: string, id: string): Promise<number | null>
}
