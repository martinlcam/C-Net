/**
 * rclone-style sync decisions for a re-dropped folder: given one local file and what the
 * destination folder already holds, decide whether to skip it, resume an open session,
 * replace a changed file, or upload it fresh. Pure; no I/O.
 */

export type LocalFile = { name: string; size: number; mtimeMs: number }

export type ExistingFile = {
  id: string
  name: string
  size: number
  sourceModifiedAt: string | null
}

export type OpenSession = {
  id: string
  filename: string
  expectedSize: number
  sourceModifiedAt: string | null
  chunkSize: number
  chunkCount: number
  receivedChunks: number[]
}

export type SyncDecision =
  | { kind: "skip" }
  | { kind: "resume"; session: OpenSession }
  | { kind: "replace"; fileId: string }
  | { kind: "new" }

/** rclone's default modtime window is one second; sub-second drift is not a change. */
function sameSecond(mtimeMs: number, iso: string | null): boolean {
  if (!iso) return false
  const remote = Date.parse(iso)
  if (Number.isNaN(remote)) return false
  return Math.floor(mtimeMs / 1000) === Math.floor(remote / 1000)
}

export function classify(
  local: LocalFile,
  existing: ExistingFile[],
  sessions: OpenSession[]
): SyncDecision {
  const session = sessions.find(
    (s) =>
      s.filename === local.name &&
      s.expectedSize === local.size &&
      sameSecond(local.mtimeMs, s.sourceModifiedAt)
  )
  if (session) return { kind: "resume", session }

  const file = existing.find((f) => f.name === local.name)
  if (!file) return { kind: "new" }
  if (file.size === local.size && sameSecond(local.mtimeMs, file.sourceModifiedAt)) {
    return { kind: "skip" }
  }
  return { kind: "replace", fileId: file.id }
}
