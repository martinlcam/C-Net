import { resolveCollision } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultDirectories, vaultFiles } from "@cnet/db/schema"
import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Delete, Get, Path, Post, Query, Request, Route, Security } from "tsoa"
import { actorFrom } from "../vault/access"
import { type DirectoryListing, listDirectory } from "../vault/listing"
import { liveDirNames } from "../vault/siblings"

type CreateDirBody = { parentId?: string | null; name: string }
type RenameDirBody = { name: string }
type MoveDirBody = { parentId: string | null }
type DirResult = { id: string; name: string; path: string; parentId: string | null }

@Route("vault/directories")
@Security("jwt")
export class VaultDirectoriesController extends Controller {
  /** GET /vault/directories?directoryId= — list a folder (null = root). */
  @Get()
  public async list(
    @Request() req: ExpressRequest,
    @Query() directoryId?: string
  ): Promise<DirectoryListing> {
    const actor = actorFrom(req)
    return listDirectory(actor.id, directoryId ?? null, Date.now())
  }

  /** POST /vault/directories — create a folder under parentId (null = root). */
  @Post()
  public async create(
    @Request() req: ExpressRequest,
    @Body() body: CreateDirBody
  ): Promise<DirResult> {
    const actor = actorFrom(req)
    const parentId = body.parentId ?? null
    const parent = parentId ? await this.loadDir(actor.id, parentId) : null
    if (parentId && !parent) {
      this.setStatus(404)
      throw new Error("Parent directory not found")
    }
    const name = resolveCollision(body.name, await liveDirNames(actor.id, parentId))
    const parentPath = parent?.path ?? null
    const path = parentPath ? `${parentPath}/${name}` : name
    const [created] = await db
      .insert(vaultDirectories)
      .values({ ownerUserId: actor.id, name, path, parentId, parentPath })
      .returning()
    this.setStatus(201)
    return { id: created.id, name: created.name, path: created.path, parentId: created.parentId }
  }

  /** POST /vault/directories/:id/rename */
  @Post("{id}/rename")
  public async rename(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: RenameDirBody
  ): Promise<DirResult> {
    const actor = actorFrom(req)
    const dir = await this.loadDir(actor.id, id)
    if (!dir) {
      this.setStatus(404)
      throw new Error("Directory not found")
    }
    const name = resolveCollision(body.name, await liveDirNames(actor.id, dir.parentId, dir.id))
    const newPath = dir.parentPath ? `${dir.parentPath}/${name}` : name
    await this.repathDescendants(actor.id, dir.path, newPath)
    const [updated] = await db
      .update(vaultDirectories)
      .set({ name, path: newPath, updatedAt: new Date() })
      .where(eq(vaultDirectories.id, dir.id))
      .returning()
    return { id: updated.id, name: updated.name, path: updated.path, parentId: updated.parentId }
  }

  /** POST /vault/directories/:id/move — reparent (parentId null = root). */
  @Post("{id}/move")
  public async move(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Body() body: MoveDirBody
  ): Promise<DirResult> {
    const actor = actorFrom(req)
    const dir = await this.loadDir(actor.id, id)
    if (!dir) {
      this.setStatus(404)
      throw new Error("Directory not found")
    }
    const newParent = body.parentId ? await this.loadDir(actor.id, body.parentId) : null
    if (body.parentId && !newParent) {
      this.setStatus(404)
      throw new Error("Target directory not found")
    }
    // Reject moving into self or a descendant (would create a cycle).
    if (newParent && (newParent.id === dir.id || newParent.path.startsWith(`${dir.path}/`))) {
      this.setStatus(400)
      throw new Error("Cannot move a directory into itself or a descendant")
    }
    const name = resolveCollision(dir.name, await liveDirNames(actor.id, body.parentId ?? null))
    const newParentPath = newParent?.path ?? null
    const newPath = newParentPath ? `${newParentPath}/${name}` : name
    await this.repathDescendants(actor.id, dir.path, newPath)
    const [updated] = await db
      .update(vaultDirectories)
      .set({
        name,
        path: newPath,
        parentId: body.parentId ?? null,
        parentPath: newParentPath,
        updatedAt: new Date(),
      })
      .where(eq(vaultDirectories.id, dir.id))
      .returning()
    return { id: updated.id, name: updated.name, path: updated.path, parentId: updated.parentId }
  }

  /** DELETE /vault/directories/:id — soft-delete the folder, its subtree, and their files. */
  @Delete("{id}")
  public async remove(
    @Request() req: ExpressRequest,
    @Path() id: string
  ): Promise<{ deleted: true }> {
    const actor = actorFrom(req)
    const dir = await this.loadDir(actor.id, id)
    if (!dir) {
      this.setStatus(404)
      throw new Error("Directory not found")
    }
    const subtree = await db
      .select({ id: vaultDirectories.id })
      .from(vaultDirectories)
      .where(
        and(
          eq(vaultDirectories.ownerUserId, actor.id),
          isNull(vaultDirectories.deletedAt),
          or(eq(vaultDirectories.path, dir.path), like(vaultDirectories.path, `${dir.path}/%`))
        )
      )
    const dirIds = subtree.map((d) => d.id)
    const now = new Date()
    if (dirIds.length > 0) {
      await db
        .update(vaultFiles)
        .set({ deletedAt: now, originalDirectoryId: vaultFiles.directoryId })
        .where(
          and(
            eq(vaultFiles.ownerUserId, actor.id),
            isNull(vaultFiles.deletedAt),
            inArray(vaultFiles.directoryId, dirIds)
          )
        )
      await db
        .update(vaultDirectories)
        .set({
          deletedAt: now,
          originalParentId: vaultDirectories.parentId,
          originalPath: vaultDirectories.path,
        })
        .where(inArray(vaultDirectories.id, dirIds))
    }
    return { deleted: true }
  }

  private async loadDir(ownerUserId: string, id: string) {
    const dir = await db.query.vaultDirectories.findFirst({
      where: and(
        eq(vaultDirectories.id, id),
        eq(vaultDirectories.ownerUserId, ownerUserId),
        isNull(vaultDirectories.deletedAt)
      ),
    })
    return dir ?? null
  }

  /** Rewrite path + parentPath prefixes for every descendant of oldPath. */
  private async repathDescendants(
    ownerUserId: string,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    await db
      .update(vaultDirectories)
      .set({
        path: sql`${newPath} || substring(${vaultDirectories.path} from ${oldPath.length + 1})`,
        parentPath: sql`${newPath} || substring(${vaultDirectories.parentPath} from ${oldPath.length + 1})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vaultDirectories.ownerUserId, ownerUserId),
          like(vaultDirectories.path, `${oldPath}/%`)
        )
      )
  }
}
