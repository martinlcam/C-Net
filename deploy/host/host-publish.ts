/**
 * cnet-host-publish — runs on the PVE host (the UPS's USB cable, pvesh, /proc and the
 * guests' cgroups live there). Every 2 s it publishes one HostLiveFrame on Redis
 * `host:status` (apps/realtime fans it out to /host/live), keeps the last 90 frames in the
 * `host:history` list for replay on page load, and every fifth tick refreshes the
 * `ups:status` snapshot the REST overview reads. Nothing new listens on the network.
 *
 * CPU is computed here, not asked of pvesh: Proxmox's `cpu` fields are rates between two
 * samples kept in its daemon, and a fresh pvesh process always reports 0. This process is
 * long-lived, so it diffs /proc/stat and each container's cgroup cpu.stat itself.
 *
 * Self-contained on purpose (Bun's built-in Redis client, no node_modules): the host is
 * not part of the deploy loop. Installed by deploy/systemd/cnet-host-publish.service
 * together with cpu-rates.ts and sensors.ts.
 */

import { readdir } from "node:fs/promises"
import { cpus as osCpus } from "node:os"
import { RedisClient } from "bun"
import {
  cgroupCpuFraction,
  type ProcStatCpu,
  parseProcStatCpu,
  procStatCpuRates,
} from "./cpu-rates"
import {
  DEFAULT_SENSOR_LABELS,
  type FanReading,
  meanKhzToMhz,
  milliToC,
  parsePsiSome,
  parseSensorLabels,
  pwmToPercent,
  sumObjsetCounters,
  type TempReading,
  type ZfsCounters,
} from "./sensors"

const CHANNEL = "host:status"
const HISTORY_KEY = "host:history"
const HISTORY_LEN = 90
const UPS_KEY = "ups:status"
const UPS = process.env.UPS_NAME || "cyberpower"
const NODE = process.env.PVE_NODE || "proxbox"
const NIC = process.env.HOST_NIC || "vmbr0"
const INTERVAL_MS = Number(process.env.HOST_PUBLISH_INTERVAL_MS || 2000)
const UPS_SNAPSHOT_EVERY = 5
const UPS_TTL_SECONDS = Math.ceil((INTERVAL_MS * UPS_SNAPSHOT_EVERY * 6) / 1000)
const CORES = osCpus().length
const SENSOR_LABELS = parseSensorLabels(process.env.HOST_SENSOR_LABELS || DEFAULT_SENSOR_LABELS)
const HWMON = "/sys/class/hwmon"
const ZFS_KSTAT = "/proc/spl/kstat/zfs"

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

async function readText(path: string): Promise<string | null> {
  try {
    return await Bun.file(path).text()
  } catch {
    return null
  }
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

/* ---- rate state kept between ticks ---- */
let prevProc: { at: number; cpu: ProcStatCpu } | null = null
const prevGuestUsec = new Map<number, { at: number; usec: number }>()

async function nodeCpu(): Promise<{ cpu: number; iowait: number }> {
  const stat = await readText("/proc/stat")
  const line = stat?.split("\n")[0]
  if (!line) return { cpu: 0, iowait: 0 }
  const now = { at: Date.now(), cpu: parseProcStatCpu(line) }
  const rates = prevProc ? procStatCpuRates(prevProc.cpu, now.cpu) : { cpu: 0, iowait: 0 }
  prevProc = now
  return rates
}

async function guestCpu(vmid: number, cores: number, at: number): Promise<number> {
  const text = await readText(`/sys/fs/cgroup/lxc/${vmid}/cpu.stat`)
  const usec = num(text?.match(/^usage_usec (\d+)/m)?.[1])
  if (usec === null) {
    prevGuestUsec.delete(vmid)
    return 0
  }
  const prev = prevGuestUsec.get(vmid)
  prevGuestUsec.set(vmid, { at, usec })
  return prev ? cgroupCpuFraction(prev.usec, usec, at - prev.at, cores) : 0
}

async function loadavg(): Promise<number[]> {
  const text = await readText("/proc/loadavg")
  return (text ?? "").split(/\s+/).slice(0, 3).map(Number).filter(Number.isFinite)
}

async function nicCounters(): Promise<{ netin: number; netout: number }> {
  const [rx, tx] = await Promise.all([
    readText(`/sys/class/net/${NIC}/statistics/rx_bytes`),
    readText(`/sys/class/net/${NIC}/statistics/tx_bytes`),
  ])
  return { netin: num(rx?.trim()) ?? 0, netout: num(tx?.trim()) ?? 0 }
}

async function listDir(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

/*
 * Temperatures and fans from hwmon. Only inputs named in SENSOR_LABELS are published as
 * temperatures (a board exposes a dozen, most unlabelled); every fan tachometer is, with
 * pwm duty standing in when a driver has no tachometer (nouveau's GPU fan).
 */
async function sensors(): Promise<{ temps: TempReading[]; fans: FanReading[] }> {
  const temps: TempReading[] = []
  const fans: FanReading[] = []
  for (const dir of await listDir(HWMON)) {
    const base = `${HWMON}/${dir}`
    const driver = (await readText(`${base}/name`))?.trim()
    if (!driver) continue
    const files = await listDir(base)
    for (const file of files) {
      const temp = file.match(/^(temp\d+)_input$/)
      if (temp) {
        const label = SENSOR_LABELS.get(`${driver}:${temp[1]}`)
        const c = label ? milliToC(await readText(`${base}/${file}`)) : null
        if (label && c !== null) temps.push({ label, c })
        continue
      }
      const fan = file.match(/^(fan\d+)_input$/)
      if (fan) {
        const rpm = num((await readText(`${base}/${file}`))?.trim())
        const name = (await readText(`${base}/${fan[1]}_label`))?.trim()
        const label = SENSOR_LABELS.get(`${driver}:${fan[1]}`) ?? name ?? `${driver} ${fan[1]}`
        if (rpm !== null) fans.push({ label, rpm, percent: null })
        continue
      }
      const pwm = file.match(/^(pwm\d+)$/)
      if (pwm && !files.includes(`fan${pwm[1].slice(3)}_input`)) {
        const percent = pwmToPercent(await readText(`${base}/${file}`))
        const label = SENSOR_LABELS.get(`${driver}:${pwm[1]}`) ?? `${driver} fan`
        if (percent !== null) fans.push({ label, rpm: null, percent })
      }
    }
  }
  temps.sort((a, b) => a.label.localeCompare(b.label))
  return { temps, fans }
}

/** Cumulative IO per imported pool, summed over its datasets' objset kstats. */
async function zfsCounters(): Promise<ZfsCounters[]> {
  const out: ZfsCounters[] = []
  for (const pool of await listDir(ZFS_KSTAT)) {
    const files = (await listDir(`${ZFS_KSTAT}/${pool}`)).filter((f) => f.startsWith("objset-"))
    if (files.length === 0) continue
    const texts = await Promise.all(files.map((f) => readText(`${ZFS_KSTAT}/${pool}/${f}`)))
    out.push(
      sumObjsetCounters(
        pool,
        texts.filter((t): t is string => t !== null)
      )
    )
  }
  return out.sort((a, b) => a.pool.localeCompare(b.pool))
}

async function pressure(): Promise<{ cpu: number; io: number; mem: number } | undefined> {
  const [cpu, io, mem] = await Promise.all(
    ["cpu", "io", "memory"].map(async (k) => parsePsiSome(await readText(`/proc/pressure/${k}`)))
  )
  if (cpu === null && io === null && mem === null) return undefined
  return { cpu: cpu ?? 0, io: io ?? 0, mem: mem ?? 0 }
}

async function cpuMhz(): Promise<number | null> {
  const values = await Promise.all(
    Array.from({ length: CORES }, (_, i) =>
      readText(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`)
    )
  )
  return meanKhzToMhz(values)
}

type PveGuest = Record<string, unknown>

async function guests(at: number) {
  const [lxc, qemu] = await Promise.all([
    run(["pvesh", "get", `/nodes/${NODE}/lxc`, "--output-format", "json"]).then(
      (s) => JSON.parse(s) as PveGuest[]
    ),
    run(["pvesh", "get", `/nodes/${NODE}/qemu`, "--output-format", "json"])
      .then((s) => JSON.parse(s) as PveGuest[])
      .catch(() => [] as PveGuest[]),
  ])
  const map = async (g: PveGuest, type: "lxc" | "qemu") => {
    const vmid = Number(g.vmid)
    const cores = num(g.cpus) ?? 1
    const running = String(g.status) === "running"
    return {
      vmid,
      name: String(g.name ?? ""),
      type,
      status: String(g.status ?? "stopped"),
      cpus: cores,
      // Only containers have a cgroup we can read; a VM keeps pvesh's value (0 here).
      cpu: running && type === "lxc" ? await guestCpu(vmid, cores, at) : (num(g.cpu) ?? 0),
      mem: num(g.mem) ?? 0,
      maxmem: num(g.maxmem) ?? 0,
      disk: num(g.disk) ?? 0,
      maxdisk: num(g.maxdisk) ?? 0,
      diskread: num(g.diskread) ?? 0,
      diskwrite: num(g.diskwrite) ?? 0,
      netin: num(g.netin) ?? 0,
      netout: num(g.netout) ?? 0,
      uptimeSeconds: num(g.uptime) ?? 0,
    }
  }
  const all = await Promise.all([
    ...lxc.map((g) => map(g, "lxc")),
    ...qemu.map((g) => map(g, "qemu")),
  ])
  return all.sort((a, b) => a.vmid - b.vmid)
}

async function nodeStatus() {
  const [s, cpu, load, net, mhz, psi] = await Promise.all([
    run(["pvesh", "get", `/nodes/${NODE}/status`, "--output-format", "json"]).then(JSON.parse),
    nodeCpu(),
    loadavg(),
    nicCounters(),
    cpuMhz(),
    pressure(),
  ])
  return {
    cpu: cpu.cpu,
    iowait: cpu.iowait,
    cores: CORES,
    cpuMhz: mhz ?? undefined,
    psi,
    loadavg: load,
    mem: num(s.memory?.used) ?? 0,
    maxmem: num(s.memory?.total) ?? 0,
    swap: num(s.swap?.used) ?? 0,
    maxswap: num(s.swap?.total) ?? 0,
    uptimeSeconds: num(s.uptime) ?? 0,
    ...net,
  }
}

let tickNo = 0
async function tick(): Promise<void> {
  tickNo++
  const at = Date.now()
  const [upsVars, node, gs, sens, zfs] = await Promise.all([
    run(["upsc", UPS])
      .then(parseUpsc)
      .catch((e) => {
        console.error("[host-publish]", (e as Error).message)
        return null
      }),
    nodeStatus(),
    guests(at),
    sensors(),
    zfsCounters(),
  ])
  const ts = Date.now()
  const frame = {
    t: "host",
    ts,
    node,
    guests: gs,
    ups: upsVars ? upsFrom(upsVars) : null,
    sensors: sens,
    zfs,
  }
  const json = JSON.stringify(frame)
  await redis.publish(CHANNEL, json)
  await redis.send("LPUSH", [HISTORY_KEY, json])
  await redis.send("LTRIM", [HISTORY_KEY, "0", String(HISTORY_LEN - 1)])
  if (upsVars && tickNo % UPS_SNAPSHOT_EVERY === 1) {
    await redis.set(UPS_KEY, JSON.stringify({ ts, vars: upsVars }), "EX", UPS_TTL_SECONDS)
  }
}

console.log(
  `[host-publish] ${NODE}: ${CHANNEL} every ${INTERVAL_MS} ms, ${HISTORY_LEN} frames of history, ${CORES} cores, nic ${NIC}`
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
