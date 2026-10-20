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
  /** `replaceFileId` is set when a same-name live file must give way once the resume lands. */
  | { kind: "resume"; session: OpenSession; replaceFileId?: string }
  | { kind: "replace"; fileId: string }
  | { kind: "new" }

/** rclone's default modtime window is one second; sub-second drift is not a change. */
function sameSecond(mtimeMs: number, iso: string | null): boolean {
  if (!iso) return false
  const remote = Date.parse(iso)
  if (Number.isNaN(remote)) return false
  return Math.floor(mtimeMs / 1000) === Math.floor(remote / 1000)
}

/**
 * "Already there" means same size and same modified time. A file uploaded before modified
 * times were recorded has none; like rclone against a remote without modtimes, size alone
 * decides then, otherwise every old file would be re-sent on the first re-drop.
 */
function alreadyThere(local: LocalFile, file: ExistingFile): boolean {
  if (file.size !== local.size) return false
  return file.sourceModifiedAt === null || sameSecond(local.mtimeMs, file.sourceModifiedAt)
}

export function classify(
  local: LocalFile,
  existing: ExistingFile[],
  sessions: OpenSession[]
): SyncDecision {
  const file = existing.find((f) => f.name === local.name)
  if (file && alreadyThere(local, file)) return { kind: "skip" }

  const session = sessions.find(
    (s) =>
      s.filename === local.name &&
      s.expectedSize === local.size &&
      sameSecond(local.mtimeMs, s.sourceModifiedAt)
  )
  if (session) {
    return file ? { kind: "resume", session, replaceFileId: file.id } : { kind: "resume", session }
  }
  if (!file) return { kind: "new" }
  return { kind: "replace", fileId: file.id }
}
