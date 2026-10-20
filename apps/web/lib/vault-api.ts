import { RetryableError, runWithConcurrency, withRetry } from "./upload-scheduler"

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
      throw new Error(`Chunk ${index} failed (${res.status})`)
    },
    { attempts: CHUNK_ATTEMPTS, baseMs: CHUNK_BACKOFF_MS }
  )
}

/**
 * Upload one file as parallel, retried chunks. `onProgress` receives acknowledged bytes
 * over total as a fraction.
 */
export async function uploadFile(
  file: File,
  directoryId: string | null,
  onProgress?: (fraction: number) => void
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
  const indexes = Array.from({ length: open.chunkCount }, (_, i) => i)
  let acked = 0
  await runWithConcurrency(indexes, CHUNKS_IN_FLIGHT, async (index) => {
    const start = index * open.chunkSize
    const blob = file.slice(start, Math.min(start + open.chunkSize, file.size))
    await putChunk(open.uploadId, index, blob)
    acked += blob.size
    onProgress?.(file.size === 0 ? 1 : acked / file.size)
  })
  return req<VaultFile>(`/vault/uploads/${open.uploadId}/finalize`, { method: "POST" })
}

/** Per-file hooks while a folder (and its subtree) uploads. */
export type FolderUploadHandlers = {
  onProgress: (file: File, fraction: number) => void
  onDone?: (file: File, result: VaultFile) => void
  onError?: (file: File, err: unknown) => void
}

/**
 * Upload a whole folder picked with a directory input, recreating its nested
 * directory tree under `parentId` first, then uploading each file into the
 * directory that mirrors its `webkitRelativePath`. Directories are created
 * parents-first so every child resolves to a real, owned directory id; we key
 * off the returned ids (not names) so collision-renamed folders still nest
 * their contents correctly.
 */
export async function uploadFolder(
  files: File[],
  parentId: string | null,
  handlers: FolderUploadHandlers
): Promise<void> {
  // Map a file's relative path to "directory part" + "filename".
  const relOf = (f: File) => f.webkitRelativePath || f.name
  const dirPartOf = (rel: string) => {
    const i = rel.lastIndexOf("/")
    return i === -1 ? "" : rel.slice(0, i)
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

  // 2. Create them parents-first; "" maps to the upload target directory.
  const dirIds = new Map<string, string | null>([["", parentId]])
  const ordered = [...dirPaths].sort((a, b) => a.split("/").length - b.split("/").length)
  for (const path of ordered) {
    const i = path.lastIndexOf("/")
    const parentPath = i === -1 ? "" : path.slice(0, i)
    const name = i === -1 ? path : path.slice(i + 1)
    const created = await createDir(dirIds.get(parentPath) ?? parentId, name)
    dirIds.set(path, created.id)
  }

  // 3. Upload files into their mirrored directories, a couple at a time.
  await runWithConcurrency(files, FILES_IN_FLIGHT, async (f) => {
    const targetId = dirIds.get(dirPartOf(relOf(f))) ?? parentId
    try {
      const result = await uploadFile(f, targetId, (frac) => handlers.onProgress(f, frac))
      handlers.onDone?.(f, result)
    } catch (err) {
      handlers.onError?.(f, err)
    }
  })
}
