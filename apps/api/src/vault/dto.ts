import { db } from "@cnet/db"
import { type vaultFiles, vaultItemMetadata } from "@cnet/db/schema"
import { and, eq, inArray, isNotNull } from "drizzle-orm"
import { type SignedUrls, signedUrlsFor } from "./urls"

export type FileDto = {
  id: string
  filename: string
  size: number
  contentType: string
  directoryId: string | null
  thumbKey: string | null
  starred: boolean
  color: string | null
} & SignedUrls

export type DirDto = { id: string; name: string; path: string; parentId: string | null }

type Meta = { starredAt: Date | null; color: string | null }

export function toFileDto(f: typeof vaultFiles.$inferSelect, nowMs: number, meta?: Meta): FileDto {
  return {
    id: f.id,
    filename: f.filename,
    size: f.size,
    contentType: f.contentType,
    directoryId: f.directoryId,
    thumbKey: f.thumbKey,
    starred: meta?.starredAt != null,
    color: meta?.color ?? null,
    ...signedUrlsFor(f.ownerUserId, f.id, nowMs),
  }
}

/** Enrich a list of files with the viewer's per-item metadata (starred/color) in one query. */
export async function toFileDtos(
  files: (typeof vaultFiles.$inferSelect)[],
  viewerUserId: string,
  nowMs: number
): Promise<FileDto[]> {
  if (files.length === 0) return []
  const rows = await db
    .select({
      fileId: vaultItemMetadata.fileId,
      starredAt: vaultItemMetadata.starredAt,
      color: vaultItemMetadata.color,
    })
    .from(vaultItemMetadata)
    .where(
      and(
        eq(vaultItemMetadata.userId, viewerUserId),
        inArray(
          vaultItemMetadata.fileId,
          files.map((f) => f.id)
        )
      )
    )
  const metaById = new Map(rows.map((r) => [r.fileId, { starredAt: r.starredAt, color: r.color }]))
  return files.map((f) => toFileDto(f, nowMs, metaById.get(f.id) ?? undefined))
}

/** File ids the viewer has given a color, for the Colored view. */
export async function coloredFileIds(viewerUserId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ fileId: vaultItemMetadata.fileId, color: vaultItemMetadata.color })
    .from(vaultItemMetadata)
    .where(and(eq(vaultItemMetadata.userId, viewerUserId), isNotNull(vaultItemMetadata.color)))
  const out = new Map<string, string>()
  for (const r of rows) if (r.fileId && r.color) out.set(r.fileId, r.color)
  return out
}
