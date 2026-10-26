import type { PoolStatus } from "./storage-types"

/*
 * Drives and pools taken out of service on purpose (pool exported, drives detached so
 * nothing wakes them). Proxmox stops listing both, so without this the Storage page would
 * show the bays as empty and the pool would vanish. The admin declares them in
 * CNET_STORAGE_RETIRED as "bay:serial:pool:raid,..." and the page shows the truth: a
 * powered-down drive in a bay, and an OFFLINE pool.
 */

export interface RetiredBay {
  bayIndex: number
  serial: string
  pool: string
  raid: string
}

export function parseRetiredSpec(spec: string | undefined): RetiredBay[] {
  if (!spec) return []
  const out: RetiredBay[] = []
  for (const part of spec.split(",")) {
    const [bay, serial, pool, raid] = part.split(":").map((s) => s.trim())
    const bayIndex = Number(bay)
    if (!Number.isInteger(bayIndex) || !serial || !pool || !raid) continue
    out.push({ bayIndex, serial, pool, raid })
  }
  return out
}

/** Add an OFFLINE entry for each retired pool that Proxmox no longer reports. */
export function withRetiredPools(pools: PoolStatus[], retired: RetiredBay[]): PoolStatus[] {
  const present = new Set(pools.map((p) => p.name))
  const byPool = new Map<string, RetiredBay[]>()
  for (const r of retired) {
    if (present.has(r.pool)) continue
    byPool.set(r.pool, [...(byPool.get(r.pool) ?? []), r])
  }
  const synthesized: PoolStatus[] = [...byPool.entries()].map(([name, members]) => ({
    name,
    state: "OFFLINE",
    raid: members[0].raid,
    sizeBytes: 0,
    allocBytes: 0,
    freeBytes: 0,
    fragPercent: 0,
    scan: { kind: "none", inProgress: false, raw: "pool exported; drives powered down" },
    errors: "Not imported",
    vdevs: members.map((m) => ({
      serial: m.serial,
      state: "OFFLINE",
      read: 0,
      write: 0,
      cksum: 0,
    })),
  }))
  return [...pools, ...synthesized]
}
