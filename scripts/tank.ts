/**
 * Local vault storage helpers. Run from repo root: bun run tank:clear
 */
import { existsSync, readFileSync } from "node:fs"
import { readdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { findRepoRoot, isLocalDataTankPath, resolveTankMountPath } from "../packages/core/src/paths"

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function loadRootEnv(): void {
  const envPath = join(scriptRoot, ".env")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue
    process.env[key] = trimmed.slice(eq + 1).trim()
  }
}

loadRootEnv()

async function clear(): Promise<number> {
  const tankPath = resolveTankMountPath()
  if (!isLocalDataTankPath(tankPath)) {
    console.error(
      `Refusing to clear ${tankPath}: tank:clear only deletes under ${join(findRepoRoot(), ".data")}`
    )
    return 1
  }

  if (!existsSync(tankPath)) {
    console.log(`Nothing to clear (${tankPath} does not exist).`)
    return 0
  }

  const entries = await readdir(tankPath)
  for (const entry of entries) {
    await rm(join(tankPath, entry), { recursive: true, force: true })
  }

  console.log(`Cleared ${tankPath} (${entries.length} item(s)).`)
  console.log(
    "Note: vault metadata in Postgres is unchanged; run db:studio or delete rows manually if needed."
  )
  return 0
}

async function main(): Promise<number> {
  const cmd = process.argv[2]
  if (cmd === "clear") return clear()

  console.error("Usage: bun scripts/tank.ts clear")
  return 1
}

process.exit(await main())
