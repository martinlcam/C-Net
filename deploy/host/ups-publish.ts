/**
 * cnet-ups-publish — runs on the PVE host next to NUT. Every few seconds it reads the UPS
 * through `upsc` (NUT stays bound to localhost) and stores the raw variables in the Redis
 * the C-Net API already uses, under `ups:status` as `{ ts, vars }`. The API summarizes it
 * for the dashboard; nothing new listens on the network.
 *
 * Runs with Bun's built-in Redis client, so the host needs no node_modules. Installed by
 * deploy/systemd/cnet-ups-publish.service (EnvironmentFile supplies REDIS_URL).
 */
import { RedisClient } from "bun"

const KEY = "ups:status"
const UPS = process.env.UPS_NAME || "cyberpower"
const INTERVAL_MS = Number(process.env.UPS_PUBLISH_INTERVAL_MS || 10_000)
// A reading older than twice the interval would be misleading, so let it expire.
const TTL_SECONDS = Math.ceil((INTERVAL_MS * 6) / 1000)

const url = process.env.REDIS_URL
if (!url) {
  console.error("[ups-publish] REDIS_URL is not set")
  process.exit(1)
}
const redis = new RedisClient(url)

function parse(text: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const i = line.indexOf(": ")
    if (i <= 0) continue
    vars[line.slice(0, i).trim()] = line.slice(i + 2).trim()
  }
  return vars
}

async function tick(): Promise<void> {
  const proc = Bun.spawn(["upsc", UPS], { stdout: "pipe", stderr: "pipe" })
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const code = await proc.exited
  if (code !== 0) {
    console.error(`[ups-publish] upsc exited ${code}: ${err.trim()}`)
    return
  }
  const vars = parse(out)
  if (!vars["ups.status"]) {
    console.error("[ups-publish] upsc output had no ups.status; not publishing")
    return
  }
  await redis.set(KEY, JSON.stringify({ ts: Date.now(), vars }), "EX", TTL_SECONDS)
}

console.log(`[ups-publish] publishing ${UPS} to ${KEY} every ${INTERVAL_MS} ms`)
await tick().catch((e) => console.error("[ups-publish] first tick failed:", (e as Error).message))
setInterval(() => {
  tick().catch((e) => console.error("[ups-publish] tick failed:", (e as Error).message))
}, INTERVAL_MS)
