import { createReadStream, type ReadStream } from "node:fs"
import { appendFile, mkdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { StorageAdapter } from "./adapter"

export class FilesystemAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private userDir(userId: string): string {
    return join(this.root, "cnet", "users", userId)
  }
  private filePath(userId: string, id: string): string {
    return join(this.userDir(userId), id)
  }
  private partPath(userId: string, id: string): string {
    return `${this.filePath(userId, id)}.part`
  }
  private thumbPath(userId: string, id: string): string {
    return join(this.userDir(userId), ".thumbs", `${id}.webp`)
  }

  async appendChunk(userId: string, id: string, _index: number, body: Buffer): Promise<void> {
    const p = this.partPath(userId, id)
    await mkdir(dirname(p), { recursive: true })
    await appendFile(p, body)
  }
  async finalize(userId: string, id: string): Promise<void> {
    await rename(this.partPath(userId, id), this.filePath(userId, id))
  }
  async remove(userId: string, id: string): Promise<void> {
    await rm(this.filePath(userId, id), { force: true })
    await rm(this.partPath(userId, id), { force: true })
    await rm(this.thumbPath(userId, id), { force: true })
  }
  async writeThumb(userId: string, id: string, body: Buffer): Promise<void> {
    const p = this.thumbPath(userId, id)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, body)
  }
  resolvePath(userId: string, id: string): string {
    return this.filePath(userId, id)
  }
  createReadStream(userId: string, id: string, range?: { start: number; end: number }): ReadStream {
    return createReadStream(this.filePath(userId, id), range)
  }
  async size(userId: string, id: string): Promise<number> {
    const s = await stat(this.filePath(userId, id))
    return s.size
  }
}

let singleton: FilesystemAdapter | null = null
export function getStorageAdapter(): FilesystemAdapter {
  if (!singleton) {
    const root = process.env.TANK_MOUNT_PATH
    if (!root) throw new Error("TANK_MOUNT_PATH is not set")
    singleton = new FilesystemAdapter(root)
  }
  return singleton
}
