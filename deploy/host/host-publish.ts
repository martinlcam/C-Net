/**
 * cnet-host-publish — runs on the PVE host (the UPS's USB cable and pvesh live there).
 * Every 2 s it publishes one HostLiveFrame on Redis `host:status` (apps/realtime fans it
 * out to /host/live), keeps the last 90 frames in the `host:history` list for replay on
 * page load, and every fifth tick refreshes the `ups:status` snapshot the REST overview
 * reads. Nothing new listens on the network: NUT stays on localhost, pvesh is local.
 *
 * Self-contained on purpose (Bun's built-in Redis client, no node_modules): the host is
 * not part of the deploy loop. Installed by deploy/systemd/cnet-host-publish.service.
 */
import { RedisClient } from "bun"

const CHANNEL = "host:status"
const HISTORY_KEY = "host:history"
const HISTORY_LEN = 90
const UPS_KEY = "ups:status"
const UPS = process.env.UPS_NAME || "cyberpower"
const NODE = process.env.PVE_NODE || "proxbox"
const INTERVAL_MS = Number(process.env.HOST_PUBLISH_INTERVAL_MS || 2000)
const UPS_SNAPSHOT_EVERY = 5
const UPS_TTL_SECONDS = Math.ceil((INTERVAL_MS * UPS_SNAPSHOT_EVERY * 6) / 1000)

const url = process.env.REDIS_URL
if (!url) {
  console.error("[host-publish] REDIS_URL is not set")
  process.exit(1)
}
const redis = new RedisClient(url)

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" })
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  if ((await proc.exited) !== 0) throw new Error(`${cmd[0]} failed: ${err.trim().slice(0, 200)}`)
  return out
}

function parseUpsc(text: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const i = line.indexOf(": ")
    if (i <= 0) continue
    vars[line.slice(0, i).trim()] = line.slice(i + 2).trim()
  }
  return vars
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function upsFrom(vars: Record<string, string>) {
  const status = (vars["ups.status"] ?? "").split(/\s+/).filter(Boolean)
  const loadPercent = num(vars["ups.load"])
  const nominalWatts = num(vars["ups.realpower.nominal"])
  return {
    status,
    onBattery: status.includes("OB"),
    lowBattery: status.includes("LB"),
    chargePercent: num(vars["battery.charge"]),
    runtimeSeconds: num(vars["battery.runtime"]),
    loadPercent,
    loadWatts:
      loadPercent !== null && nominalWatts !== null
        ? Math.round((loadPercent / 100) * nominalWatts)
        : null,
    nominalWatts,
    inputVoltage: num(vars["input.voltage"]),
  }
}

type PveGuest = Record<string, unknown>

async function guests(): Promise<unknown[]> {
  const [lxc, qemu] = await Promise.all([
    run(["pvesh", "get", `/nodes/${NODE}/lxc`, "--output-format", "json"]).then(
      (s) => JSON.parse(s) as PveGuest[]
    ),
    run(["pvesh", "get", `/nodes/${NODE}/qemu`, "--output-format", "json"])
      .then((s) => JSON.parse(s) as PveGuest[])
      .catch(() => [] as PveGuest[]),
  ])
  const map = (g: PveGuest, type: "lxc" | "qemu") => ({
    vmid: Number(g.vmid),
    name: String(g.name ?? ""),
    type,
    status: String(g.status ?? "stopped"),
    cpu: num(g.cpu) ?? 0,
    mem: num(g.mem) ?? 0,
    maxmem: num(g.maxmem) ?? 0,
    netin: num(g.netin) ?? 0,
    netout: num(g.netout) ?? 0,
    uptimeSeconds: num(g.uptime) ?? 0,
  })
  return [...lxc.map((g) => map(g, "lxc")), ...qemu.map((g) => map(g, "qemu"))].sort(
    (a, b) => a.vmid - b.vmid
  )
}

async function nodeStatus() {
  const s = JSON.parse(
    await run(["pvesh", "get", `/nodes/${NODE}/status`, "--output-format", "json"])
  )
  return {
    cpu: num(s.cpu) ?? 0,
    mem: num(s.memory?.used) ?? 0,
    maxmem: num(s.memory?.total) ?? 0,
    uptimeSeconds: num(s.uptime) ?? 0,
  }
}

let tickNo = 0
async function tick(): Promise<void> {
  tickNo++
  const [upsVars, node, gs] = await Promise.all([
    run(["upsc", UPS])
      .then(parseUpsc)
      .catch((e) => {
        console.error("[host-publish]", (e as Error).message)
        return null
      }),
    nodeStatus(),
    guests(),
  ])
  const ts = Date.now()
  const frame = { t: "host", ts, node, guests: gs, ups: upsVars ? upsFrom(upsVars) : null }
  const json = JSON.stringify(frame)
  await redis.publish(CHANNEL, json)
  await redis.send("LPUSH", [HISTORY_KEY, json])
  await redis.send("LTRIM", [HISTORY_KEY, "0", String(HISTORY_LEN - 1)])
  if (upsVars && tickNo % UPS_SNAPSHOT_EVERY === 1) {
    await redis.set(UPS_KEY, JSON.stringify({ ts, vars: upsVars }), "EX", UPS_TTL_SECONDS)
  }
}

console.log(
  `[host-publish] ${NODE}: ${CHANNEL} every ${INTERVAL_MS} ms, ${HISTORY_LEN} frames of history`
)
let busy = false
setInterval(() => {
  if (busy) return // a slow pvesh must not stack ticks
  busy = true
  tick()
    .catch((e) => console.error("[host-publish] tick failed:", (e as Error).message))
    .finally(() => {
      busy = false
    })
}, INTERVAL_MS)
