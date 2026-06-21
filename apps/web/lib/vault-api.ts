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
const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MiB

type CreateUploadResult = { uploadId: string; chunkSize: number; chunkCount: number }

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
    }),
  })

  for (let index = 0; index < open.chunkCount; index++) {
    const start = index * open.chunkSize
    const blob = file.slice(start, start + open.chunkSize)
    const res = await fetch(`${API_BASE}/vault/uploads/${open.uploadId}/chunks/${index}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/octet-stream" },
      body: blob,
    })
    if (!res.ok) throw new Error(`Chunk ${index} failed`)
    onProgress?.((index + 1) / open.chunkCount)
  }

  return req<VaultFile>(`/vault/uploads/${open.uploadId}/finalize`, { method: "POST" })
}
