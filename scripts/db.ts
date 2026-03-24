/**
 * Dev helpers for Docker Postgres + Redis (see docker-compose.yml).
 * Run from repo root: bun run db:start | db:stop | db:reset
 */
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function docker(args: string[], ignoreExitCode = false): number {
  const r = spawnSync("docker", args, { cwd: root, stdio: "inherit" })
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
