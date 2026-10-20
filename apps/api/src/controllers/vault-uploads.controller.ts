import { getVaultThumbnailsQueue, resolveCollision } from "@cnet/core"
import { db } from "@cnet/db"
import { vaultFiles, vaultUploads } from "@cnet/db/schema"
import { getStorageAdapter } from "@cnet/engine"
import { and, eq, isNull, sql } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Path, Post, Put, Query, Request, Route, Security } from "tsoa"
import { HttpError } from "../middleware/error.middleware"
import { actorFrom } from "../vault/access"
import { type FileDto, toFileDto } from "../vault/dto"
import { liveFileNames } from "../vault/siblings"
import { completedUsage, wouldExceedQuota } from "../vault/usage"

// Each chunk is buffered in memory by readBody, so the client's chunk size is capped.
const MAX_CHUNK_BYTES = 64 * 1024 * 1024

type CreateUploadBody = {
  directoryId?: string | null
  filename: string
  contentType: string
  expectedSize: number
  chunkSize: number
  /** The source file's own modified time (ISO 8601), as the browser reports it. */
  sourceModifiedAt?: string
}
type CreateUploadResult = { uploadId: string; chunkSize: number; chunkCount: number }
type UploadProgress = { receivedChunks: number[]; uploadedBytes: number; chunkCount: number }
/** An open (unfinalized) upload session, enough for a client to resume it. */
type UploadSessionDto = {
  id: string
  directoryId: string | null
  filename: string
  expectedSize: number
  chunkSize: number
  chunkCount: number
  receivedChunks: number[]
  sourceModifiedAt: string | null
}

async function readBody(req: ExpressRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

@Route("vault/uploads")
@Security("jwt")
export class VaultUploadsController extends Controller {
  /** GET /vault/uploads?directoryId= — the caller's open sessions in one folder (omit = root). */
  @Get()
  public async listSessions(
    @Request() req: ExpressRequest,
    @Query() directoryId?: string
  ): Promise<UploadSessionDto[]> {
    const actor = actorFrom(req)
    const rows = await db
      .select()
      .from(vaultUploads)
      .where(
        and(
          eq(vaultUploads.ownerUserId, actor.id),
          directoryId ? eq(vaultUploads.directoryId, directoryId) : isNull(vaultUploads.directoryId)
        )
      )
    return rows.map((u) => ({
      id: u.id,
      directoryId: u.directoryId,
      filename: u.filename,
      expectedSize: u.expectedSize,
      chunkSize: u.chunkSize,
      chunkCount: u.chunkCount,
      receivedChunks: u.receivedChunks,
      sourceModifiedAt: u.sourceModifiedAt?.toISOString() ?? null,
    }))
  }

  /** POST /vault/uploads — open an upload session (quota pre-flight at start). */
  @Post()
  public async createUpload(
    @Request() req: ExpressRequest,
    @Body() body: CreateUploadBody
  ): Promise<CreateUploadResult> {
    const actor = actorFrom(req)
    if (body.chunkSize <= 0 || body.expectedSize < 0 || body.chunkSize > MAX_CHUNK_BYTES) {
      throw new HttpError(
        400,
        `chunkSize must be 1..${MAX_CHUNK_BYTES} bytes and expectedSize >= 0`
      )
    }
    if (await wouldExceedQuota(actor.id, actor.quotaBytes, body.expectedSize)) {
      throw new HttpError(413, "Quota exceeded")
    }
    const sourceModifiedAt = body.sourceModifiedAt ? new Date(body.sourceModifiedAt) : null
    if (sourceModifiedAt && Number.isNaN(sourceModifiedAt.getTime())) {
      throw new HttpError(400, "sourceModifiedAt must be an ISO 8601 date")
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
        sourceModifiedAt,
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
      throw new HttpError(404, "Upload session not found")
    }
    if (!Number.isInteger(index) || index < 0 || index >= upload.chunkCount) {
      throw new HttpError(400, `Chunk index ${index} outside 0..${upload.chunkCount - 1}`)
    }
    const body = await readBody(req)
    const isLast = index === upload.chunkCount - 1
    const expectedLen = isLast ? upload.expectedSize - index * upload.chunkSize : upload.chunkSize
    if (body.length !== expectedLen) {
      throw new HttpError(400, `Chunk ${index} must be ${expectedLen} bytes, got ${body.length}`)
    }
    await getStorageAdapter().writeChunk(actor.id, id, index * upload.chunkSize, body)
    // One atomic statement: add the index only if absent and derive progress from the
    // distinct count, so concurrent chunks cannot lose each other's updates.
    const merged = sql`(select array_agg(distinct i order by i) from unnest(array_append(${vaultUploads.receivedChunks}, ${index}::int)) as i)`
    const [row] = await db
      .update(vaultUploads)
      .set({
        receivedChunks: merged,
        uploadedBytes: sql`least(${vaultUploads.expectedSize}, cardinality(${merged}) * ${vaultUploads.chunkSize})`,
        lastChunkAt: new Date(),
      })
      .where(eq(vaultUploads.id, id))
      .returning({ receivedChunks: vaultUploads.receivedChunks })
    return { received: row.receivedChunks.length }
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
      throw new HttpError(404, "Upload session not found")
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
      throw new HttpError(404, "Upload session not found")
    }
    // Every chunk 0..chunkCount-1 must be present.
    const present = new Set(upload.receivedChunks)
    for (let i = 0; i < upload.chunkCount; i++) {
      if (!present.has(i)) {
        throw new HttpError(409, `Missing chunk ${i}; resume before finalizing`)
      }
    }
    // The bytes on disk are the truth; a counter can drift if a write failed after the
    // chunk was recorded, and a short file must never graduate to vault_files.
    const onDisk = await getStorageAdapter().partSize(actor.id, id)
    if (onDisk !== upload.expectedSize) {
      throw new HttpError(
        409,
        `Upload has ${onDisk ?? 0} bytes on disk, expected ${upload.expectedSize}; resume before finalizing`
      )
    }
    // Quota re-check against the real size (guards a wrong expectedSize at open time).
    const completed = await completedUsage(actor.id)
    if (actor.quotaBytes !== null && completed + upload.expectedSize > actor.quotaBytes) {
      await getStorageAdapter().remove(actor.id, id)
      await db.delete(vaultUploads).where(eq(vaultUploads.id, id))
      throw new HttpError(413, "Quota exceeded")
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
        size: upload.expectedSize,
        contentType: upload.contentType,
        sourceModifiedAt: upload.sourceModifiedAt,
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
