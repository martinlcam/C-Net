import { getVaultThumbnailsQueue, resolveCollision } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultFiles, vaultUploads } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import { and, eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Path, Post, Put, Request, Route, Security } from "tsoa"
import { actorFrom } from "../vault/access"
import { type FileDto, toFileDto } from "../vault/dto"
import { liveFileNames } from "../vault/siblings"
import { completedUsage, wouldExceedQuota } from "../vault/usage"

type CreateUploadBody = {
  directoryId?: string | null
  filename: string
  contentType: string
  expectedSize: number
  chunkSize: number
}
type CreateUploadResult = { uploadId: string; chunkSize: number; chunkCount: number }
type UploadProgress = { receivedChunks: number[]; uploadedBytes: number; chunkCount: number }

async function readBody(req: ExpressRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

@Route("vault/uploads")
@Security("jwt")
export class VaultUploadsController extends Controller {
  /** POST /vault/uploads — open an upload session (quota pre-flight at start). */
  @Post()
  public async createUpload(
    @Request() req: ExpressRequest,
    @Body() body: CreateUploadBody
  ): Promise<CreateUploadResult> {
    const actor = actorFrom(req)
    if (body.chunkSize <= 0 || body.expectedSize < 0) {
      this.setStatus(400)
      throw new Error("Invalid chunkSize or expectedSize")
    }
    if (await wouldExceedQuota(actor.id, actor.quotaBytes, body.expectedSize)) {
      this.setStatus(413)
      throw new Error("Quota exceeded")
    }
    const chunkCount = Math.max(1, Math.ceil(body.expectedSize / body.chunkSize))
    const [upload] = await db
      .insert(vaultUploads)
      .values({
        ownerUserId: actor.id,
        directoryId: body.directoryId ?? null,
        filename: body.filename,
        contentType: body.contentType,
        expectedSize: body.expectedSize,
        chunkSize: body.chunkSize,
        chunkCount,
      })
      .returning()
    this.setStatus(201)
    return { uploadId: upload.id, chunkSize: body.chunkSize, chunkCount }
  }

  /** PUT /vault/uploads/:id/chunks/:index — append one raw binary chunk. */
  @Put("{id}/chunks/{index}")
  public async putChunk(
    @Request() req: ExpressRequest,
    @Path() id: string,
    @Path() index: number
  ): Promise<{ received: number }> {
    const actor = actorFrom(req)
    const upload = await this.loadUpload(actor.id, id)
    if (!upload) {
      this.setStatus(404)
      throw new Error("Upload session not found")
    }
    const body = await readBody(req)
    await getStorageAdapter().appendChunk(actor.id, id, index, body)
    const received = upload.receivedChunks.includes(index)
      ? upload.receivedChunks
      : [...upload.receivedChunks, index]
    await db
      .update(vaultUploads)
      .set({
        receivedChunks: received,
        uploadedBytes: upload.uploadedBytes + body.length,
        lastChunkAt: new Date(),
      })
      .where(eq(vaultUploads.id, id))
    return { received: received.length }
  }

  /** GET /vault/uploads/:id — resume info. */
  @Get("{id}")
  public async progress(
    @Request() req: ExpressRequest,
    @Path() id: string
  ): Promise<UploadProgress> {
    const actor = actorFrom(req)
    const upload = await this.loadUpload(actor.id, id)
    if (!upload) {
      this.setStatus(404)
      throw new Error("Upload session not found")
    }
    return {
      receivedChunks: upload.receivedChunks,
      uploadedBytes: upload.uploadedBytes,
      chunkCount: upload.chunkCount,
    }
  }

  /** POST /vault/uploads/:id/finalize — assemble, store, graduate to vault_files. */
  @Post("{id}/finalize")
  public async finalize(@Request() req: ExpressRequest, @Path() id: string): Promise<FileDto> {
    const actor = actorFrom(req)
    const upload = await this.loadUpload(actor.id, id)
    if (!upload) {
      this.setStatus(404)
      throw new Error("Upload session not found")
    }
    // Every chunk 0..chunkCount-1 must be present.
    const present = new Set(upload.receivedChunks)
    for (let i = 0; i < upload.chunkCount; i++) {
      if (!present.has(i)) {
        this.setStatus(409)
        throw new Error(`Missing chunk ${i}; resume before finalizing`)
      }
    }
    // Quota re-check against actual bytes (guards a wrong expectedSize).
    const completed = await completedUsage(actor.id)
    if (actor.quotaBytes !== null && completed + upload.uploadedBytes > actor.quotaBytes) {
      await getStorageAdapter().remove(actor.id, id)
      await db.delete(vaultUploads).where(eq(vaultUploads.id, id))
      this.setStatus(413)
      throw new Error("Quota exceeded")
    }

    await getStorageAdapter().finalize(actor.id, id)
    const filename = resolveCollision(
      upload.filename,
      await liveFileNames(actor.id, upload.directoryId)
    )
    const [file] = await db
      .insert(vaultFiles)
      .values({
        id, // reuse the upload id as the file id and on-disk key
        ownerUserId: actor.id,
        directoryId: upload.directoryId,
        filename,
        size: upload.uploadedBytes,
        contentType: upload.contentType,
      })
      .returning()
    await db.delete(vaultUploads).where(eq(vaultUploads.id, id))

    // Best-effort thumbnail enqueue (worker lands in Plan 2; never block finalize).
    try {
      await getVaultThumbnailsQueue().add("thumbnail", {
        userId: actor.id,
        fileId: file.id,
        contentType: file.contentType,
      })
    } catch (err) {
      console.error("Failed to enqueue thumbnail job:", err)
    }

    this.setStatus(201)
    return toFileDto(file, Date.now())
  }

  private async loadUpload(ownerUserId: string, id: string) {
    const upload = await db.query.vaultUploads.findFirst({
      where: and(eq(vaultUploads.id, id), eq(vaultUploads.ownerUserId, ownerUserId)),
    })
    return upload ?? null
  }
}
