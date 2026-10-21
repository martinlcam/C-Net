import {
  isGoneSession,
  RetryableError,
  runWithConcurrency,
  UploadRequestError,
  withRetry,
} from "./upload-scheduler"
import { bytesToSend, classify, type ExistingFile } from "./upload-sync"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export type VaultFile = {
  id: string
  filename: string
  size: number
  contentType: string
  directoryId: string | null
  thumbKey: string | null
  starred: boolean
  color: string | null
  sourceModifiedAt: string | null
  previewUrl: string
  downloadUrl: string
  thumbUrl: string
  renderedPdfUrl: string
}

export type VaultDir = {
  id: string
  name: string
  path: string
  parentId: string | null
}

export type Breadcrumb = { label: string; directoryId: string | null }

export type DirectoryListing = {
  directory: VaultDir | null
  breadcrumbs: Breadcrumb[]
  directories: VaultDir[]
  files: VaultFile[]
}

export type AdminUser = {
  email: string
  role: string
  quotaBytes: number | null
  userId: string | null
  usageBytes: number
}

/** Absolute URL for a signed download/preview path returned by the API. */
export function vaultUrl(path: string): string {
  return `${API_BASE}${path}`
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(body.message || "Request failed")
  }
  return res.json() as Promise<T>
}

// --- directories ---
export function listDir(directoryId?: string | null): Promise<DirectoryListing> {
  const q = directoryId ? `?directoryId=${encodeURIComponent(directoryId)}` : ""
  return req<DirectoryListing>(`/vault/directories${q}`)
}
export function createDir(parentId: string | null, name: string): Promise<VaultDir> {
  return req("/vault/directories", { method: "POST", body: JSON.stringify({ parentId, name }) })
}
export function renameDir(id: string, name: string): Promise<VaultDir> {
  return req(`/vault/directories/${id}/rename`, { method: "POST", body: JSON.stringify({ name }) })
}
export function deleteDir(id: string): Promise<{ deleted: true }> {
  return req(`/vault/directories/${id}`, { method: "DELETE" })
}

// --- files ---
export function renameFile(id: string, name: string): Promise<VaultFile> {
  return req(`/vault/files/${id}/rename`, { method: "POST", body: JSON.stringify({ name }) })
}
export function moveFile(id: string, directoryId: string | null): Promise<VaultFile> {
  return req(`/vault/files/${id}/move`, { method: "POST", body: JSON.stringify({ directoryId }) })
}
export function deleteFile(id: string): Promise<{ deleted: true }> {
  return req(`/vault/files/${id}`, { method: "DELETE" })
}
export function restoreFile(id: string): Promise<VaultFile> {
  return req(`/vault/files/${id}/restore`, { method: "POST" })
}
export function purgeFile(id: string): Promise<{ purged: true }> {
  return req(`/vault/files/${id}/permanent`, { method: "DELETE" })
}
export function starFile(id: string): Promise<{ ok: true }> {
  return req(`/vault/files/${id}/star`, { method: "POST" })
}
export function unstarFile(id: string): Promise<{ ok: true }> {
  return req(`/vault/files/${id}/star`, { method: "DELETE" })
}
export function setFileColor(id: string, color: string | null): Promise<{ ok: true }> {
  return req(`/vault/files/${id}/color`, { method: "POST", body: JSON.stringify({ color }) })
}
export function reprocessFile(id: string): Promise<{ queued: true }> {
  return req(`/vault/files/${id}/reprocess`, { method: "POST" })
}

// --- views ---
export function search(q: string): Promise<{ files: VaultFile[] }> {
  return req(`/vault/search?q=${encodeURIComponent(q)}`)
}
export function getTrash(): Promise<{ files: VaultFile[]; directories: VaultDir[] }> {
  return req("/vault/trash")
}
export function getStarred(): Promise<{ files: VaultFile[] }> {
  return req("/vault/starred")
}
export function getColored(): Promise<{ files: VaultFile[] }> {
  return req("/vault/colored")
}

// --- admin ---
export function adminUsers(): Promise<{ users: AdminUser[] }> {
  return req("/admin/vault/users")
}
export function adminListDir(
  userId: string,
  directoryId?: string | null
): Promise<DirectoryListing> {
  const q = directoryId ? `?directoryId=${encodeURIComponent(directoryId)}` : ""
  return req(`/admin/vault/${userId}/directories${q}`)
}
export function adminDeleteFile(userId: string, id: string): Promise<{ deleted: true }> {
  return req(`/admin/vault/${userId}/files/${id}`, { method: "DELETE" })
}

// --- chunked upload ---
// 16 MiB chunks: well under the API's 64 MiB cap and Cloudflare's 100 MB body limit.
const CHUNK_SIZE = 16 * 1024 * 1024
// Per file. A 96 MB window keeps a high-latency tunnel busy instead of waiting on each
// round trip; the server writes chunks by offset, so order does not matter.
const CHUNKS_IN_FLIGHT = 6
// Files at a time, so one file's last chunk never leaves the link idle.
const FILES_IN_FLIGHT = 2
const CHUNK_ATTEMPTS = 5
const CHUNK_BACKOFF_MS = 1000

type CreateUploadResult = { uploadId: string; chunkSize: number; chunkCount: number }

/** An open upload session on the server; see UploadSessionDto on the API side. */
export type UploadSession = {
  id: string
  directoryId: string | null
  filename: string
  expectedSize: number
  chunkSize: number
  chunkCount: number
  receivedChunks: number[]
  sourceModifiedAt: string | null
}

export function listUploadSessions(directoryId: string | null): Promise<UploadSession[]> {
  const q = directoryId ? `?directoryId=${encodeURIComponent(directoryId)}` : ""
  return req<UploadSession[]>(`/vault/uploads${q}`)
}

async function putChunk(uploadId: string, index: number, blob: Blob): Promise<void> {
  await withRetry(
    async () => {
      let res: Response
      try {
        res = await fetch(`${API_BASE}/vault/uploads/${uploadId}/chunks/${index}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob,
        })
      } catch (err) {
        const why = err instanceof Error ? err.message : "network error"
        throw new RetryableError(`Chunk ${index}: ${why}`)
      }
      if (res.ok) return
      if (res.status >= 500 || res.status === 429) {
        throw new RetryableError(`Chunk ${index} failed (${res.status})`)
      }
      throw new UploadRequestError(res.status, `Chunk ${index} failed (${res.status})`)
    },
    { attempts: CHUNK_ATTEMPTS, baseMs: CHUNK_BACKOFF_MS }
  )
}

type SessionShape = { id: string; chunkSize: number; chunkCount: number }

/** Send every chunk not in `have`, in parallel; progress counts acknowledged bytes. */
async function sendChunks(
  session: SessionShape,
  file: File,
  have: Set<number>,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const sizeOf = (index: number) =>
    Math.min(session.chunkSize, file.size - index * session.chunkSize)
  let acked = 0
  const todo: number[] = []
  for (let i = 0; i < session.chunkCount; i++) {
    if (have.has(i)) acked += sizeOf(i)
    else todo.push(i)
  }
  onProgress?.(file.size === 0 ? 1 : acked / file.size)
  await runWithConcurrency(todo, CHUNKS_IN_FLIGHT, async (index) => {
    const start = index * session.chunkSize
    const blob = file.slice(start, start + sizeOf(index))
    await putChunk(session.id, index, blob)
    acked += blob.size
    onProgress?.(file.size === 0 ? 1 : acked / file.size)
  })
}

type UploadProgress = { receivedChunks: number[]; uploadedBytes: number; chunkCount: number }

/**
 * Finalize, and on a 409 (server has fewer bytes than expected) fetch what it has,
 * re-send the rest once, and finalize again.
 */
async function finalizeUpload(
  session: SessionShape,
  file: File,
  replaceFileId?: string,
  onProgress?: (fraction: number) => void
): Promise<VaultFile> {
  const attempt = () =>
    fetch(`${API_BASE}/vault/uploads/${session.id}/finalize`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(replaceFileId ? { replaceFileId } : {}),
    })
  let res = await attempt()
  if (res.status === 409) {
    const progress = await req<UploadProgress>(`/vault/uploads/${session.id}`)
    await sendChunks(session, file, new Set(progress.receivedChunks), onProgress)
    res = await attempt()
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new UploadRequestError(res.status, body.message || "Finalize failed")
  }
  return res.json() as Promise<VaultFile>
}

export type UploadOptions = {
  /** Replace this existing same-name file (it goes to the trash) instead of renaming. */
  replaceFileId?: string
}

/**
 * Upload one file as parallel, retried chunks. `onProgress` receives acknowledged bytes
 * over total as a fraction.
 */
export async function uploadFile(
  file: File,
  directoryId: string | null,
  onProgress?: (fraction: number) => void,
  options: UploadOptions = {}
): Promise<VaultFile> {
  const open = await req<CreateUploadResult>("/vault/uploads", {
    method: "POST",
    body: JSON.stringify({
      directoryId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      expectedSize: file.size,
      chunkSize: CHUNK_SIZE,
      sourceModifiedAt: new Date(file.lastModified).toISOString(),
    }),
  })
  const session = { id: open.uploadId, chunkSize: open.chunkSize, chunkCount: open.chunkCount }
  await sendChunks(session, file, new Set(), onProgress)
  return finalizeUpload(session, file, options.replaceFileId, onProgress)
}

/** Continue an open session: send only the chunks the server does not have, then finalize. */
export async function resumeUpload(
  session: Pick<UploadSession, "id" | "chunkSize" | "chunkCount" | "receivedChunks">,
  file: File,
  onProgress?: (fraction: number) => void,
  options: UploadOptions = {}
): Promise<VaultFile> {
  await sendChunks(session, file, new Set(session.receivedChunks), onProgress)
  return finalizeUpload(session, file, options.replaceFileId, onProgress)
}

/** Per-file hooks while a folder (and its subtree) uploads. */
export type FolderUploadHandlers = {
  onProgress: (file: File, fraction: number) => void
  onDone?: (file: File, result: VaultFile) => void
  onError?: (file: File, err: unknown) => void
  /** The destination already has this exact file (name, size, modified time). */
  onSkip?: (file: File) => void
  /** An earlier, interrupted upload of this file is being continued. */
  onResume?: (file: File) => void
  /** Running total of bytes acknowledged by the server, and the bytes this drop will send. */
  onBytes?: (sent: number, planned: number) => void
}

export type FolderUploadSummary = {
  uploaded: number
  skipped: number
  resumed: number
  replaced: number
  failed: number
  /** Bytes actually put on the wire by this drop. */
  bytes: number
}

/**
 * Upload a folder picked with a directory input the way `rclone copy` would: existing
 * directories are reused by name, files already present (same name, size and modified
 * time) are skipped, interrupted uploads are resumed, changed files replace the old copy
 * (which goes to the trash), and everything else uploads fresh. Dropping the same folder
 * again after a crash therefore sends only what is missing.
 */
export async function uploadFolder(
  files: File[],
  parentId: string | null,
  handlers: FolderUploadHandlers
): Promise<FolderUploadSummary> {
  // Map a file's relative path to "directory part" + "filename".
  const relOf = (f: File) => f.webkitRelativePath || f.name
  const dirPartOf = (rel: string) => {
    const i = rel.lastIndexOf("/")
    return i === -1 ? "" : rel.slice(0, i)
  }

  // One listing per directory id, shared by the directory walk and the per-file checks.
  const listings = new Map<string | null, Promise<DirectoryListing>>()
  const listingOf = (id: string | null) => {
    let p = listings.get(id)
    if (!p) {
      p = listDir(id)
      listings.set(id, p)
    }
    return p
  }
  const sessionsCache = new Map<string | null, Promise<UploadSession[]>>()
  const sessionsOf = (id: string | null) => {
    let p = sessionsCache.get(id)
    if (!p) {
      p = listUploadSessions(id)
      sessionsCache.set(id, p)
    }
    return p
  }

  // 1. Collect every unique directory path in the selection.
  const dirPaths = new Set<string>()
  for (const f of files) {
    const segs = dirPartOf(relOf(f)).split("/").filter(Boolean)
    let acc = ""
    for (const seg of segs) {
      acc = acc ? `${acc}/${seg}` : seg
      dirPaths.add(acc)
    }
  }

  // 2. Resolve them parents-first, reusing a same-named child when it already exists;
  //    "" maps to the upload target directory.
  const dirIds = new Map<string, string | null>([["", parentId]])
  const ordered = [...dirPaths].sort((a, b) => a.split("/").length - b.split("/").length)
  for (const path of ordered) {
    const i = path.lastIndexOf("/")
    const parentPath = i === -1 ? "" : path.slice(0, i)
    const name = i === -1 ? path : path.slice(i + 1)
    const under = dirIds.get(parentPath) ?? parentId
    const existing = (await listingOf(under)).directories.find((dir) => dir.name === name)
    if (existing) {
      dirIds.set(path, existing.id)
    } else {
      const created = await createDir(under, name)
      dirIds.set(path, created.id)
      listings.delete(under) // the parent listing is stale now
    }
  }

  // 3. Classify and transfer, a couple of files at a time.
  const summary: FolderUploadSummary = {
    uploaded: 0,
    skipped: 0,
    resumed: 0,
    replaced: 0,
    failed: 0,
    bytes: 0,
  }
  // Bytes acknowledged so far per file, so the running total survives parallel progress.
  const ackedByFile = new Map<File, number>()
  let planned = 0
  const reportBytes = () => {
    let sent = 0
    for (const n of ackedByFile.values()) sent += n
    handlers.onBytes?.(sent, planned)
  }
  await runWithConcurrency(files, FILES_IN_FLIGHT, async (f) => {
    const targetId = dirIds.get(dirPartOf(relOf(f))) ?? parentId
    try {
      const [listing, sessions] = await Promise.all([listingOf(targetId), sessionsOf(targetId)])
      const existing: ExistingFile[] = listing.files.map((x) => ({
        id: x.id,
        name: x.filename,
        size: x.size,
        sourceModifiedAt: x.sourceModifiedAt,
      }))
      const decision = classify(
        { name: f.name, size: f.size, mtimeMs: f.lastModified },
        existing,
        sessions
      )
      let toSend = bytesToSend(decision, f.size)
      planned += toSend
      const progress = (frac: number) => {
        handlers.onProgress(f, frac)
        // frac counts bytes already on the server for a resume, so scale to what we send.
        const already = f.size - toSend
        ackedByFile.set(f, Math.max(0, Math.round(frac * f.size) - already))
        reportBytes()
      }
      if (decision.kind === "skip") {
        summary.skipped++
        handlers.onSkip?.(f)
        reportBytes()
        return
      }
      let result: VaultFile
      if (decision.kind === "resume") {
        handlers.onResume?.(f)
        try {
          result = await resumeUpload(decision.session, f, progress, {
            replaceFileId: decision.replaceFileId,
          })
          summary.resumed++
        } catch (err) {
          if (!isGoneSession(err)) throw err
          // The session was reaped or finalized elsewhere since we listed it: start over,
          // which means the whole file goes on the wire after all.
          planned += f.size - toSend
          toSend = f.size
          result = await uploadFile(f, targetId, progress, {
            replaceFileId: decision.replaceFileId,
          })
          summary.uploaded++
        }
      } else if (decision.kind === "replace") {
        result = await uploadFile(f, targetId, progress, { replaceFileId: decision.fileId })
        summary.replaced++
      } else {
        result = await uploadFile(f, targetId, progress)
        summary.uploaded++
      }
      summary.bytes += toSend
      ackedByFile.set(f, toSend)
      reportBytes()
      handlers.onDone?.(f, result)
    } catch (err) {
      summary.failed++
      handlers.onError?.(f, err)
    }
  })
  return summary
}
