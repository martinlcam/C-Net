// Pin every direct dependency range to its exact installed version.
// Workspace/protocol specifiers (workspace:, link:, file:, catalog:) are left alone.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]

function pkgJsonPaths(): string[] {
  const out = [join(root, "package.json")]
  for (const group of ["apps", "packages"]) {
    const dir = join(root, group)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      const p = join(dir, name, "package.json")
      if (existsSync(p)) out.push(p)
    }
  }
  return out
}

function installedVersion(name: string, fromDir: string): string | null {
  for (const base of [join(fromDir, "node_modules"), join(root, "node_modules")]) {
    const p = join(base, name, "package.json")
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf8")).version as string
      } catch {
        return null
      }
    }
  }
  return null
}

function shouldSkip(spec: string): boolean {
  return /^(workspace:|link:|file:|catalog:|npm:|github:|git\+|https?:)/.test(spec)
}

let changed = 0
const unresolved: string[] = []

for (const file of pkgJsonPaths()) {
  const dir = file.slice(0, -"/package.json".length)
  const json = JSON.parse(readFileSync(file, "utf8"))
  let touched = false
  for (const field of DEP_FIELDS) {
    const deps = json[field]
    if (!deps) continue
    for (const name of Object.keys(deps)) {
      const spec: string = deps[name]
      if (shouldSkip(spec)) continue
      const version = installedVersion(name, dir)
      if (!version) {
        unresolved.push(`${name} (${spec}) in ${file}`)
        continue
      }
      if (deps[name] !== version) {
        deps[name] = version
        touched = true
        changed++
      }
    }
  }
  if (touched) writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

console.log(`Pinned ${changed} dependency specifiers.`)
if (unresolved.length > 0) {
  console.log(`\nUnresolved (left as-is):`)
  for (const u of unresolved) console.log(`  ${u}`)
}
