#!/usr/bin/env bun
/**
 * Regenerates `generated/attributions.json` from the web app's production
 * dependency tree. Wired to `prebuild`, so `next build` always renders a
 * current /attributions page.
 *
 * Failure here must never break a build: a flaky license-checker run degrades
 * to keeping the committed snapshot rather than blocking a deploy.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** Full Apache-2.0/GPL texts run to hundreds of lines; the page shows a gist, not a notice file. */
export const LICENSE_EXCERPT_LINES = 30

/** C-Net's own workspaces are GPL-3.0 and don't attribute to themselves. */
const INTERNAL_SCOPE = "@cnet/"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const WEB_ROOT = join(dirname(SCRIPT_PATH), "..")
const OUTPUT_PATH = join(WEB_ROOT, "generated", "attributions.json")

export type Attribution = {
  name: string
  version: string
  license: string
  repository?: string
  copyright?: string
  licenseExcerpt?: string
}

export type CheckerEntry = {
  licenses?: string | string[]
  repository?: string
  publisher?: string
  path?: string
  licenseFile?: string
  private?: boolean
}

/** Scoped names carry a leading `@`, so the version delimiter is the *last* one. */
export function parsePackageKey(key: string): { name: string; version: string } {
  const at = key.lastIndexOf("@")
  if (at <= 0) return { name: key, version: "" }
  return { name: key.slice(0, at), version: key.slice(at + 1) }
}

export function normalizeLicense(licenses: CheckerEntry["licenses"]): string {
  if (Array.isArray(licenses)) return licenses.join(" OR ")
  return licenses?.trim() || "UNKNOWN"
}

export function shouldInclude(key: string, entry: CheckerEntry): boolean {
  if (entry.private) return false
  return !key.startsWith(INTERNAL_SCOPE)
}

/**
 * license-checker points `licenseFile` at a README when a package ships no
 * license file, which would otherwise land package prose in `licenseExcerpt`.
 */
export function isLicenseFile(filePath: string): boolean {
  return /^(licen[cs]e|copying|unlicen[cs]e)/i.test(basename(filePath))
}

const PLACEHOLDER = /\[yyyy\]|\[year\]|<year>|\[name of copyright owner\]|<name of author>/i

/** Permission boilerplate wraps onto lines that begin with "copyright", e.g. ISC's
 * "...provided that the above\ncopyright notice and this permission notice appear...". */
const BOILERPLATE = /^copyright\s+(notice|holders?|owners?)\b/i

/**
 * Scrapes copyright lines rather than trusting any single field. Anything
 * ambiguous is dropped: a wrong attribution is worse than a missing one.
 */
export function findCopyright(text: string): string | undefined {
  const seen = new Set<string>()
  for (const raw of text.split("\n")) {
    const line = raw
      .trim()
      .replace(/^[*#/\s]+/, "")
      .trim()
    if (!/^(copyright\b|\(c\)\s|©)/i.test(line)) continue
    if (BOILERPLATE.test(line)) continue
    if (PLACEHOLDER.test(line)) continue
    seen.add(line)
  }
  return seen.size > 0 ? [...seen].join("\n") : undefined
}

export function readLicenseExcerpt(licenseFile: string | undefined): string | undefined {
  if (!licenseFile || !isLicenseFile(licenseFile) || !existsSync(licenseFile)) return undefined
  const text = readFileSync(licenseFile, "utf8").replace(/\r\n/g, "\n")
  const excerpt = text.split("\n").slice(0, LICENSE_EXCERPT_LINES).join("\n").trimEnd()
  return excerpt || undefined
}

export function buildAttribution(key: string, entry: CheckerEntry): Attribution {
  const { name, version } = parsePackageKey(key)
  const licenseExcerpt = readLicenseExcerpt(entry.licenseFile)
  const attribution: Attribution = {
    name,
    version,
    license: normalizeLicense(entry.licenses),
  }
  if (entry.repository) attribution.repository = entry.repository
  const copyright = licenseExcerpt ? findCopyright(licenseExcerpt) : undefined
  if (copyright) attribution.copyright = copyright
  if (licenseExcerpt) attribution.licenseExcerpt = licenseExcerpt
  return attribution
}

/** Codepoint order — `localeCompare` varies across ICU builds and churns the diff. */
export function sortAttributions(attributions: Attribution[]): Attribution[] {
  return [...attributions].sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1
    return a.version < b.version ? -1 : a.version > b.version ? 1 : 0
  })
}

export function buildAttributions(raw: Record<string, CheckerEntry>): Attribution[] {
  const included = Object.entries(raw)
    .filter(([key, entry]) => shouldInclude(key, entry))
    .map(([key, entry]) => buildAttribution(key, entry))
  return sortAttributions(included)
}

function runChecker(): Record<string, CheckerEntry> {
  // `process.execPath` is the bun binary; `bun x` sidesteps resolving `bunx` on PATH.
  const proc = spawnSync(
    process.execPath,
    ["x", "license-checker-rseidelsohn", "--production", "--json"],
    // The report carries a full license file path per package and comfortably
    // exceeds node's 1 MB default buffer.
    { cwd: WEB_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
  if (proc.status !== 0) {
    throw new Error(proc.stderr?.trim() || `license-checker exited ${proc.status}`)
  }
  return JSON.parse(proc.stdout)
}

function write(attributions: Attribution[]): void {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(attributions, null, 2)}\n`)
}

function main(): void {
  try {
    const attributions = buildAttributions(runChecker())
    write(attributions)
    console.log(`attributions: wrote ${attributions.length} packages`)
  } catch (error) {
    console.warn(`Unable to scan licenses: ${error}. Continuing for v1.`)
    // A fresh clone has no snapshot to fall back on, and the page imports this
    // file at build time — an empty array keeps `next build` alive.
    if (!existsSync(OUTPUT_PATH)) write([])
  }
}

// Guarded so the test file can import the helpers without shelling out.
const entrypoint = process.argv[1]
if (entrypoint && resolve(entrypoint) === SCRIPT_PATH) main()
