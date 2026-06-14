import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles } from "@cnet/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { type SignedUrls, signedUrlsFor } from "./urls"

export type VaultFileDto = {
  id: string
  filename: string
  size: number
  contentType: string
  thumbKey: string | null
  directoryId: string | null
  createdAt: Date
  updatedAt: Date
} & SignedUrls

export type VaultDirDto = {
  id: string
  name: string
  path: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

export type Breadcrumb = { label: string; directoryId: string | null }

export type DirectoryListing = {
  directory: VaultDirDto | null
  breadcrumbs: Breadcrumb[]
  directories: VaultDirDto[]
  files: VaultFileDto[]
}

function toDirDto(d: typeof vaultDirectories.$inferSelect): VaultDirDto {
  return {
    id: d.id,
    name: d.name,
    path: d.path,
    parentId: d.parentId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

async function loadDirectory(
  ownerUserId: string,
  directoryId: string
): Promise<typeof vaultDirectories.$inferSelect | null> {
  const dir = await db.query.vaultDirectories.findFirst({
    where: and(
      eq(vaultDirectories.id, directoryId),
      eq(vaultDirectories.ownerUserId, ownerUserId),
      isNull(vaultDirectories.deletedAt)
    ),
  })
  return dir ?? null
}

async function buildBreadcrumbs(
  ownerUserId: string,
  current: typeof vaultDirectories.$inferSelect | null
): Promise<Breadcrumb[]> {
  const trail: Breadcrumb[] = []
  let node = current
  while (node) {
    trail.unshift({ label: node.name, directoryId: node.id })
    node = node.parentId ? await loadDirectory(ownerUserId, node.parentId) : null
  }
  trail.unshift({ label: "My Vault", directoryId: null })
  return trail
}

/** List a folder for `ownerUserId`. `directoryId` null = root. Live rows only. */
export async function listDirectory(
  ownerUserId: string,
  directoryId: string | null,
  nowMs: number
): Promise<DirectoryListing> {
  const current = directoryId ? await loadDirectory(ownerUserId, directoryId) : null

  const dirWhere = and(
    eq(vaultDirectories.ownerUserId, ownerUserId),
    isNull(vaultDirectories.deletedAt),
    directoryId ? eq(vaultDirectories.parentId, directoryId) : isNull(vaultDirectories.parentId)
  )
  const fileWhere = and(
    eq(vaultFiles.ownerUserId, ownerUserId),
    isNull(vaultFiles.deletedAt),
    directoryId ? eq(vaultFiles.directoryId, directoryId) : isNull(vaultFiles.directoryId)
  )

  const dirs = await db
    .select()
    .from(vaultDirectories)
    .where(dirWhere)
    .orderBy(asc(vaultDirectories.name))
  const files = await db
    .select()
    .from(vaultFiles)
    .where(fileWhere)
    .orderBy(asc(vaultFiles.filename))

  return {
    directory: current ? toDirDto(current) : null,
    breadcrumbs: await buildBreadcrumbs(ownerUserId, current),
    directories: dirs.map(toDirDto),
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      size: f.size,
      contentType: f.contentType,
      thumbKey: f.thumbKey,
      directoryId: f.directoryId,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      ...signedUrlsFor(ownerUserId, f.id, nowMs),
    })),
  }
}
