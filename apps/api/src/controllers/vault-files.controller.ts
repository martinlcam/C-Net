import { resolveCollision } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles, vaultItemMetadata } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import { and, eq, isNull } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Delete, Get, Path, Post, Request, Route, Security } from "tsoa"
import { actorFrom } from "../vault/access"
import { type FileDto, toFileDto } from "../vault/dto"
import { liveFileNames } from "../vault/siblings"

type RenameBody = { name: string }
type MoveBody = { directoryId: string | null }
type ColorBody = { color: string | null }

@Route("vault/files")
@Security("jwt")
export class VaultFilesController extends Controller {
  /** GET /vault/files/:id */
  @Get("{id}")
  public async get(@Request() req: ExpressRequest, @Path() id: string): Promise<FileDto> {
    const actor = actorFrom(req)
    const file = await this.loadFile(actor.id, id)
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
    return toFileDto(file, Date.now())
  }

  /** POST /vault/files/:id/rename */
  @Post("{id}/rename")
  public async rename(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: RenameBody
  ): Promise<FileDto> {
    const actor = actorFrom(req)
    const file = await this.loadFile(actor.id, id)
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
    const filename = resolveCollision(
      body.name,
      await liveFileNames(actor.id, file.directoryId, file.id)
    )
    const [updated] = await db
      .update(vaultFiles)
      .set({ filename, updatedAt: new Date() })
      .where(eq(vaultFiles.id, file.id))
      .returning()
    return toFileDto(updated, Date.now())
  }

  /** POST /vault/files/:id/move */
  @Post("{id}/move")
  public async move(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: MoveBody
  ): Promise<FileDto> {
    const actor = actorFrom(req)
    const file = await this.loadFile(actor.id, id)
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
    if (body.directoryId && !(await this.dirExists(actor.id, body.directoryId))) {
      this.setStatus(404)
      throw new Error("Target directory not found")
    }
    const filename = resolveCollision(
      file.filename,
      await liveFileNames(actor.id, body.directoryId, file.id)
    )
    const [updated] = await db
      .update(vaultFiles)
      .set({ directoryId: body.directoryId, filename, updatedAt: new Date() })
      .where(eq(vaultFiles.id, file.id))
      .returning()
    return toFileDto(updated, Date.now())
  }

  /** DELETE /vault/files/:id — soft delete (to trash). */
  @Delete("{id}")
  public async remove(
    @Request() req: ExpressRequest,
    @Path() id: string
  ): Promise<{ deleted: true }> {
    const actor = actorFrom(req)
    const file = await this.loadFile(actor.id, id)
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
    await db
      .update(vaultFiles)
      .set({ deletedAt: new Date(), originalDirectoryId: file.directoryId })
      .where(eq(vaultFiles.id, file.id))
    return { deleted: true }
  }

  /** POST /vault/files/:id/restore — restore to original dir (or root), collision-renamed. */
  @Post("{id}/restore")
  public async restore(@Request() req: ExpressRequest, @Path() id: string): Promise<FileDto> {
    const actor = actorFrom(req)
    const file = await db.query.vaultFiles.findFirst({
      where: and(eq(vaultFiles.id, id), eq(vaultFiles.ownerUserId, actor.id)),
    })
    if (!file || !file.deletedAt) {
      this.setStatus(404)
      throw new Error("Trashed file not found")
    }
    const target =
      file.originalDirectoryId && (await this.dirExists(actor.id, file.originalDirectoryId))
        ? file.originalDirectoryId
        : null
    const filename = resolveCollision(
      file.filename,
      await liveFileNames(actor.id, target),
      "restored"
    )
    const [restored] = await db
      .update(vaultFiles)
      .set({
        deletedAt: null,
        directoryId: target,
        originalDirectoryId: null,
        filename,
        updatedAt: new Date(),
      })
      .where(eq(vaultFiles.id, file.id))
      .returning()
    return toFileDto(restored, Date.now())
  }

  /** DELETE /vault/files/:id/permanent — hard delete bytes + row. */
  @Delete("{id}/permanent")
  public async purge(
    @Request() req: ExpressRequest,
    @Path() id: string
  ): Promise<{ purged: true }> {
    const actor = actorFrom(req)
    const file = await db.query.vaultFiles.findFirst({
      where: and(eq(vaultFiles.id, id), eq(vaultFiles.ownerUserId, actor.id)),
    })
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
    await getStorageAdapter().remove(actor.id, file.id)
    await db.delete(vaultFiles).where(eq(vaultFiles.id, file.id))
    return { purged: true }
  }

  /** POST /vault/files/:id/star */
  @Post("{id}/star")
  public async star(@Request() req: ExpressRequest, @Path() id: string): Promise<{ ok: true }> {
    const actor = actorFrom(req)
    await this.requireFile(actor.id, id)
    await this.upsertMeta(actor.id, id, { starredAt: new Date() })
    return { ok: true }
  }

  /** DELETE /vault/files/:id/star */
  @Delete("{id}/star")
  public async unstar(@Request() req: ExpressRequest, @Path() id: string): Promise<{ ok: true }> {
    const actor = actorFrom(req)
    await this.requireFile(actor.id, id)
    await this.upsertMeta(actor.id, id, { starredAt: null })
    return { ok: true }
  }

  /** POST /vault/files/:id/color */
  @Post("{id}/color")
  public async setColor(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: ColorBody
  ): Promise<{ ok: true }> {
    const actor = actorFrom(req)
    await this.requireFile(actor.id, id)
    await this.upsertMeta(actor.id, id, { color: body.color })
    return { ok: true }
  }

  private async loadFile(ownerUserId: string, id: string) {
    const file = await db.query.vaultFiles.findFirst({
      where: and(
        eq(vaultFiles.id, id),
        eq(vaultFiles.ownerUserId, ownerUserId),
        isNull(vaultFiles.deletedAt)
      ),
    })
    return file ?? null
  }

  private async requireFile(ownerUserId: string, id: string): Promise<void> {
    const file = await this.loadFile(ownerUserId, id)
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
  }

  private async dirExists(ownerUserId: string, dirId: string): Promise<boolean> {
    const dir = await db.query.vaultDirectories.findFirst({
      where: and(
        eq(vaultDirectories.id, dirId),
        eq(vaultDirectories.ownerUserId, ownerUserId),
        isNull(vaultDirectories.deletedAt)
      ),
    })
    return dir != null
  }

  private async upsertMeta(
    userId: string,
    fileId: string,
    patch: { starredAt?: Date | null; color?: string | null }
  ): Promise<void> {
    const existing = await db.query.vaultItemMetadata.findFirst({
      where: and(eq(vaultItemMetadata.userId, userId), eq(vaultItemMetadata.fileId, fileId)),
    })
    if (existing) {
      await db
        .update(vaultItemMetadata)
        .set(patch)
        .where(and(eq(vaultItemMetadata.userId, userId), eq(vaultItemMetadata.fileId, fileId)))
    } else {
      await db.insert(vaultItemMetadata).values({ userId, fileId, ...patch })
    }
  }
}
