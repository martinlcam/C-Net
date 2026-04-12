/**
 * Runs SonarScanner when SONAR_TOKEN is set (SonarCloud / SonarQube).
 * Skips otherwise so `bun run lint` stays usable without credentials.
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

if (process.env.SKIP_SONAR === "1" || process.env.SKIP_SONAR === "true") {
  console.log("[sonar] Skipping (SKIP_SONAR is set)")
  process.exit(0)
}

if (!process.env.SONAR_TOKEN) {
  console.log("[sonar] Skipping SonarScanner (set SONAR_TOKEN to run analysis with `bun run lint`)")
  process.exit(0)
}

const binDir = join(root, "node_modules", ".bin")
const sonarWin = join(binDir, "sonar-scanner.cmd")
const sonarUnix = join(binDir, "sonar-scanner")
const cmd = existsSync(sonarWin) ? sonarWin : sonarUnix

const r = spawnSync(cmd, [], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: false,
})

process.exit(r.status ?? 1)
