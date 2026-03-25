/**
 * Dev helpers for Docker Postgres + Redis (see docker-compose.yml).
 * Run from repo root: bun run db:start | db:stop | db:reset
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Prefer explicit paths (Sonar S4036) over relying on PATH for `docker`. */
function resolveDockerExecutable(): string {
  const envPath = process.env.DOCKER_CLI_PATH
  if (envPath && existsSync(envPath)) {
    return envPath
  }

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
          "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker",
        ]
      : process.platform === "darwin"
        ? ["/usr/local/bin/docker", "/opt/homebrew/bin/docker", "/usr/bin/docker"]
        : ["/usr/bin/docker", "/usr/local/bin/docker"]

  for (const p of candidates) {
    if (existsSync(p)) {
      return p
    }
  }

  console.error(
    "Could not find docker. Install Docker Desktop / CLI, or set DOCKER_CLI_PATH to the docker executable."
  )
  process.exit(1)
}

const dockerBin = resolveDockerExecutable()

function docker(args: string[], ignoreExitCode = false): number {
  const r = spawnSync(dockerBin, args, { cwd: root, stdio: "inherit" })
  const code = r.status ?? 1
  if (ignoreExitCode) return 0
  return code
}

function main(): number {
  const cmd = process.argv[2]
  if (!cmd) {
    console.error("Usage: bun scripts/db.ts <start|stop|reset>")
    return 1
  }

  if (cmd === "start") {
    return docker(["compose", "up", "postgres", "redis", "-d"])
  }

  if (cmd === "stop") {
    return docker(["compose", "stop", "postgres", "redis"])
  }

  if (cmd === "reset") {
    docker(["compose", "stop", "postgres", "redis"], true)
    docker(["compose", "rm", "-f", "postgres", "redis"], true)
    docker(["volume", "rm", "cnet_pg_data"], true)
    docker(["volume", "rm", "cnet_redis_data"], true)
    const code = docker(["compose", "up", "postgres", "redis", "-d"])
    if (code === 0) {
      console.log("\nPostgres + Redis are up with fresh volumes. Run: bun run db:migrate")
    }
    return code
  }

  console.error("Unknown command:", cmd)
  return 1
}

process.exit(main())
