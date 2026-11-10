/** Split "report.pdf" into ["report", ".pdf"]; "README" into ["README", ""]. */
function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return [name, ""]
  return [name.slice(0, dot), name.slice(dot)]
}

/**
 * Return a name not present in `taken`.
 * Default policy: "name (1).ext", "name (2).ext", ...
 * With `label` (e.g. "restored"): "name (restored).ext", "name (restored 2).ext", ...
 */
export function resolveCollision(name: string, taken: Set<string>, label?: string): string {
  if (!taken.has(name)) return name
  const [base, ext] = splitExt(name)
  if (label) {
    let candidate = `${base} (${label})${ext}`
    let n = 2
    while (taken.has(candidate)) candidate = `${base} (${label} ${n++})${ext}`
    return candidate
  }
  let n = 1
  let candidate = `${base} (${n})${ext}`
  while (taken.has(candidate)) candidate = `${base} (${++n})${ext}`
  return candidate
}

/**
 * Entry names for a zip of many files: duplicates get " (2)", " (3)"… before the extension,
 * the way a desktop does, so nothing silently overwrites inside the archive.
 */
export function uniqueZipNames(filenames: string[]): string[] {
  const taken = new Set<string>()
  return filenames.map((name) => {
    if (!taken.has(name.toLowerCase())) {
      taken.add(name.toLowerCase())
      return name
    }
    const dot = name.lastIndexOf(".")
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ""
    for (let n = 2; ; n++) {
      const candidate = `${stem} (${n})${ext}`
      if (!taken.has(candidate.toLowerCase())) {
        taken.add(candidate.toLowerCase())
        return candidate
      }
    }
  })
}
