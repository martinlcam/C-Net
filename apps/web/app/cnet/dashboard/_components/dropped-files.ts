// Turn a desktop drop into files. Folders dropped from the OS arrive as directory entries,
// which the browser only lets us walk through the (prefixed) FileSystem entry API; each
// file comes back with the path it had inside the dropped folder.

type FsEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file: (ok: (f: File) => void, err: (e: unknown) => void) => void
  createReader: () => {
    readEntries: (ok: (es: FsEntry[]) => void, err: (e: unknown) => void) => void
  }
}

export type DroppedFiles = {
  files: File[]
  /** Relative path inside a dropped folder, keyed by file; absent for loose files. */
  paths: Map<File, string>
  hasDirectories: boolean
}

/** True when the drag carries files from outside the page (not our own cards). */
export function hasDesktopFiles(dt: DataTransfer | null): boolean {
  return Boolean(dt && Array.from(dt.types).includes("Files"))
}

function readAll(entry: FsEntry): Promise<FsEntry[]> {
  const reader = entry.createReader()
  const all: FsEntry[] = []
  return new Promise((resolve, reject) => {
    const step = () =>
      reader.readEntries((batch) => {
        // readEntries returns in chunks (100 in Chrome); keep asking until it hands back nothing.
        if (batch.length === 0) resolve(all)
        else {
          all.push(...batch)
          step()
        }
      }, reject)
    step()
  })
}

async function walk(entry: FsEntry, prefix: string, out: DroppedFiles): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((ok, err) => entry.file(ok, err))
    out.files.push(file)
    if (prefix) out.paths.set(file, `${prefix}/${file.name}`)
    return
  }
  if (entry.isDirectory) {
    out.hasDirectories = true
    const children = await readAll(entry)
    const next = prefix ? `${prefix}/${entry.name}` : entry.name
    for (const child of children) await walk(child, next, out)
  }
}

export async function collectDroppedFiles(dt: DataTransfer): Promise<DroppedFiles> {
  const out: DroppedFiles = { files: [], paths: new Map(), hasDirectories: false }
  const items = Array.from(dt.items ?? [])
  // lib.dom types the entry without the callback-style file()/createReader() we use.
  const entries = items
    .map((i) => (i.kind === "file" ? (i.webkitGetAsEntry() as unknown as FsEntry | null) : null))
    .filter((e): e is FsEntry => e !== null)
  if (entries.length > 0) {
    for (const e of entries) await walk(e, "", out)
    return out
  }
  out.files.push(...Array.from(dt.files))
  return out
}
