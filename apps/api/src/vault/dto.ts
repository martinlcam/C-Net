import type { vaultFiles } from "@cnet/db/schema"
import { type SignedUrls, signedUrlsFor } from "./urls"

export type FileDto = {
  id: string
  filename: string
  size: number
  contentType: string
  directoryId: string | null
  thumbKey: string | null
} & SignedUrls

export type DirDto = { id: string; name: string; path: string; parentId: string | null }

export function toFileDto(f: typeof vaultFiles.$inferSelect, nowMs: number): FileDto {
  return {
    id: f.id,
    filename: f.filename,
    size: f.size,
    contentType: f.contentType,
    directoryId: f.directoryId,
    thumbKey: f.thumbKey,
    ...signedUrlsFor(f.ownerUserId, f.id, nowMs),
  }
}
