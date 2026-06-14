import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles } from "@cnet/db/schema"
import { and, eq, isNull } from "drizzle-orm"

/** Live sibling directory names under a parent (null = root), for collision resolution. */
export async function liveDirNames(
  ownerUserId: string,
  parentId: string | null,
  excludeId?: string
): Promise<Set<string>> {
  const rows = await db
    .select({ id: vaultDirectories.id, name: vaultDirectories.name })
    .from(vaultDirectories)
    .where(
      and(
        eq(vaultDirectories.ownerUserId, ownerUserId),
        isNull(vaultDirectories.deletedAt),
        parentId ? eq(vaultDirectories.parentId, parentId) : isNull(vaultDirectories.parentId)
      )
    )
  return new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.name))
}

/** Live sibling file names in a directory (null = root), for collision resolution. */
export async function liveFileNames(
  ownerUserId: string,
  directoryId: string | null,
  excludeId?: string
): Promise<Set<string>> {
  const rows = await db
    .select({ id: vaultFiles.id, filename: vaultFiles.filename })
    .from(vaultFiles)
    .where(
      and(
        eq(vaultFiles.ownerUserId, ownerUserId),
        isNull(vaultFiles.deletedAt),
        directoryId ? eq(vaultFiles.directoryId, directoryId) : isNull(vaultFiles.directoryId)
      )
    )
  return new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.filename))
}
