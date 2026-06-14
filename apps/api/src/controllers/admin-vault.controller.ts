import { parseAllowlist } from "@cnet/core"
import { db } from "@cnet/db"
import { users, vaultFiles } from "@cnet/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Controller, Delete, Get, Path, Query, Request, Route, Security } from "tsoa"
import { actorFrom, requireSuper } from "../vault/access"
import { type FileDto, toFileDto } from "../vault/dto"
import { type DirectoryListing, listDirectory } from "../vault/listing"
import { completedUsage } from "../vault/usage"

type AdminUser = {
  email: string
  role: string
  quotaBytes: number | null
  userId: string | null
  usageBytes: number
}

@Route("admin/vault")
@Security("jwt")
export class AdminVaultController extends Controller {
  /** GET /admin/vault/users — allowlist users with role, quota, and usage. */
  @Get("users")
  public async listUsers(@Request() req: ExpressRequest): Promise<{ users: AdminUser[] }> {
    requireSuper(actorFrom(req))
    const entries = parseAllowlist(process.env.VAULT_ALLOWLIST)
    const result: AdminUser[] = []
    for (const entry of entries) {
      const user = await db.query.users.findFirst({ where: eq(users.email, entry.email) })
      result.push({
        email: entry.email,
        role: entry.role,
        quotaBytes: entry.quotaBytes,
        userId: user?.id ?? null,
        usageBytes: user ? await completedUsage(user.id) : 0,
      })
    }
    return { users: result }
  }

  /** GET /admin/vault/:userId/directories — browse any user's folder. */
  @Get("{userId}/directories")
  public async listDirectories(
    @Request() req: ExpressRequest,
    @Path() userId: string,
    @Query() directoryId?: string
  ): Promise<DirectoryListing> {
    requireSuper(actorFrom(req))
    // The only non-session ownerUserId in the codebase, behind requireSuper.
    return listDirectory(userId, directoryId ?? null, Date.now())
  }

  /** GET /admin/vault/:userId/files/:id — signed URLs for any user's file. */
  @Get("{userId}/files/{id}")
  public async getFile(
    @Request() req: ExpressRequest,
    @Path() userId: string,
    @Path() id: string
  ): Promise<FileDto> {
    requireSuper(actorFrom(req))
    const file = await db.query.vaultFiles.findFirst({
      where: and(
        eq(vaultFiles.id, id),
        eq(vaultFiles.ownerUserId, userId),
        isNull(vaultFiles.deletedAt)
      ),
    })
    if (!file) {
      this.setStatus(404)
      throw new Error("File not found")
    }
    return toFileDto(file, Date.now())
  }

  /** DELETE /admin/vault/:userId/files/:id — soft-delete any user's file. */
  @Delete("{userId}/files/{id}")
  public async deleteFile(
    @Request() req: ExpressRequest,
    @Path() userId: string,
    @Path() id: string
  ): Promise<{ deleted: true }> {
    requireSuper(actorFrom(req))
    const file = await db.query.vaultFiles.findFirst({
      where: and(eq(vaultFiles.id, id), eq(vaultFiles.ownerUserId, userId)),
    })
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
}
