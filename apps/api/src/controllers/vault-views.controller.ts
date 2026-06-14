import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles, vaultItemMetadata } from "@cnet/db/schema"
import { and, eq, ilike, isNotNull, isNull } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Controller, Get, Query, Request, Route, Security } from "tsoa"
import { actorFrom } from "../vault/access"
import { type DirDto, type FileDto, toFileDto } from "../vault/dto"

@Route("vault")
@Security("jwt")
export class VaultViewsController extends Controller {
  /** GET /vault/search?q= — filename fuzzy match across live files. */
  @Get("search")
  public async search(
    @Request() req: ExpressRequest,
    @Query() q: string
  ): Promise<{ files: FileDto[] }> {
    const actor = actorFrom(req)
    const term = q.trim()
    if (!term) return { files: [] }
    const rows = await db
      .select()
      .from(vaultFiles)
      .where(
        and(
          eq(vaultFiles.ownerUserId, actor.id),
          isNull(vaultFiles.deletedAt),
          ilike(vaultFiles.filename, `%${term}%`)
        )
      )
      .limit(200)
    const now = Date.now()
    return { files: rows.map((f) => toFileDto(f, now)) }
  }

  /** GET /vault/starred — starred files. */
  @Get("starred")
  public async starred(@Request() req: ExpressRequest): Promise<{ files: FileDto[] }> {
    const actor = actorFrom(req)
    const rows = await db
      .select({ file: vaultFiles })
      .from(vaultItemMetadata)
      .innerJoin(vaultFiles, eq(vaultItemMetadata.fileId, vaultFiles.id))
      .where(
        and(
          eq(vaultItemMetadata.userId, actor.id),
          isNotNull(vaultItemMetadata.starredAt),
          isNull(vaultFiles.deletedAt)
        )
      )
    const now = Date.now()
    return { files: rows.map((r) => toFileDto(r.file, now)) }
  }

  /** GET /vault/trash — soft-deleted files and directories. */
  @Get("trash")
  public async trash(
    @Request() req: ExpressRequest
  ): Promise<{ files: FileDto[]; directories: DirDto[] }> {
    const actor = actorFrom(req)
    const files = await db
      .select()
      .from(vaultFiles)
      .where(and(eq(vaultFiles.ownerUserId, actor.id), isNotNull(vaultFiles.deletedAt)))
    const dirs = await db
      .select()
      .from(vaultDirectories)
      .where(and(eq(vaultDirectories.ownerUserId, actor.id), isNotNull(vaultDirectories.deletedAt)))
    const now = Date.now()
    return {
      files: files.map((f) => toFileDto(f, now)),
      directories: dirs.map((d) => ({
        id: d.id,
        name: d.name,
        path: d.path,
        parentId: d.parentId,
      })),
    }
  }
}
