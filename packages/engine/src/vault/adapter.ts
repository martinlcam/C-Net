import type { ReadStream } from "node:fs"

export interface StorageAdapter {
  // chunked upload (id = vault_uploads.id, later vault_files.id)
  /** Write `body` at byte `offset` of the in-progress `.part` (idempotent, any order). */
  writeChunk(userId: string, id: string, offset: number, body: Buffer): Promise<void>
  /** Current `.part` size, or null when no upload is in progress. */
  partSize(userId: string, id: string): Promise<number | null>
  finalize(userId: string, id: string): Promise<void> // <id>.part -> <id>
  remove(userId: string, id: string): Promise<void> // file or orphaned .part
  writeThumb(userId: string, id: string, body: Buffer): Promise<void>
  writePdf(userId: string, id: string, body: Buffer): Promise<void> // cached render
  // delivery
  resolvePath(userId: string, id: string): string
  createReadStream(userId: string, id: string, range?: { start: number; end: number }): ReadStream
  size(userId: string, id: string): Promise<number>
  // thumbnail delivery (thumbSize returns null when no thumbnail exists yet)
  thumbStream(userId: string, id: string): ReadStream
  thumbSize(userId: string, id: string): Promise<number | null>
  // rendered-PDF delivery for Office docs (renderedPdfSize is null when absent)
  renderedPdfStream(userId: string, id: string): ReadStream
  renderedPdfSize(userId: string, id: string): Promise<number | null>
}
