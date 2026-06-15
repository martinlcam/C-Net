import { existsSync } from "node:fs"
import { isAbsolute, resolve, sep } from "node:path"

/** Walk up from cwd until we find the monorepo root (package.json + turbo.json). */
export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start)
  while (true) {
    if (existsSync(resolve(dir, "package.json")) && existsSync(resolve(dir, "turbo.json"))) {
      return dir
    }
    const parent = resolve(dir, "..")
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

/** Resolve TANK_MOUNT_PATH; relative values are anchored to the repo root. */
export function resolveTankMountPath(raw?: string): string {
  const value = raw ?? process.env.TANK_MOUNT_PATH
  if (!value) throw new Error("TANK_MOUNT_PATH is not set")
  return isAbsolute(value) ? value : resolve(findRepoRoot(), value)
}

/** True when the path lives under `<repo>/.data` (local dev tank only). */
export function isLocalDataTankPath(resolved: string): boolean {
  const localRoot = resolve(findRepoRoot(), ".data")
  const normalized = resolve(resolved)
  return normalized === localRoot || normalized.startsWith(`${localRoot}${sep}`)
}
