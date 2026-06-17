import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, realpathSync } from "node:fs"
import type { SpinState } from "@cnet/engine"

/** Resolve a drive serial to its current /dev/sdX via /dev/disk/by-id. */
export function devForSerial(serial: string): string | undefined {
  try {
    const dir = "/dev/disk/by-id"
    const entry = readdirSync(dir).find(
      (n) => n.startsWith("ata-") && n.endsWith(`_${serial}`) && !n.includes("-part")
    )
    if (!entry) return undefined
    return realpathSync(`${dir}/${entry}`) // -> /dev/sdX
  } catch {
    return undefined
  }
}

/** Map of devName ("sda") -> cumulative completed IOs (reads+writes). */
export function readDiskstats(): Map<string, number> {
  const out = new Map<string, number>()
  try {
    const text = readFileSync("/proc/diskstats", "utf8")
    for (const line of text.split("\n")) {
      const f = line.trim().split(/\s+/)
      if (f.length < 8) continue
      const name = f[2]
      // Whole disks only (sd[a-z]); skip partitions like sda1.
      if (!/^sd[a-z]+$/.test(name)) continue
      const reads = Number.parseInt(f[3], 10) || 0
      const writes = Number.parseInt(f[7], 10) || 0
      out.set(name, reads + writes)
    }
  } catch {
    // /proc/diskstats unreadable — leave empty
  }
  return out
}

/**
 * Spin state via `hdparm -C`. Uses `-C` which does NOT spin a standby drive up,
 * so it's safe to poll. Returns "unknown" if hdparm is unavailable/errors.
 */
export function spinState(devPath: string): SpinState {
  try {
    const r = spawnSync("hdparm", ["-C", devPath], { encoding: "utf8", timeout: 5000 })
    const text = `${r.stdout ?? ""}`.toLowerCase()
    if (text.includes("standby")) return "standby"
    if (text.includes("active") || text.includes("idle")) return "active"
    return "unknown"
  } catch {
    return "unknown"
  }
}

export interface ResilverInfo {
  pool: string
  percent: number
}

/**
 * Parse `zpool status` for any pool currently resilvering. ZFS prints a multi-line
 * scan block; we track the current pool and look for "resilver in progress" + "% done".
 */
export function resilverStatus(): ResilverInfo | undefined {
  try {
    const r = spawnSync("zpool", ["status"], { encoding: "utf8", timeout: 8000 })
    const text = r.stdout ?? ""
    let currentPool = ""
    let inResilver = false
    for (const raw of text.split("\n")) {
      const line = raw.trim()
      const poolMatch = line.match(/^pool:\s+(\S+)/)
      if (poolMatch) {
        currentPool = poolMatch[1]
        inResilver = false
        continue
      }
      if (/resilver in progress/i.test(line)) inResilver = true
      if (inResilver) {
        const pct = line.match(/([\d.]+)%\s*done/i)
        if (pct) return { pool: currentPool, percent: Number.parseFloat(pct[1]) }
      }
    }
  } catch {
    // zpool unavailable
  }
  return undefined
}
