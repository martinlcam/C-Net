/*
 * Assembles the read-only storage view (bays + pools + SMART) from raw Proxmox
 * REST responses, the calibrated bay map, and the agent's live port→drive
 * inventory. Pure functions — no IO. See docs/ZFS_BAY_GUI_PLAN.md.
 */

import { type BayInventoryEntry, PROXBOX_BAY_MAP } from "./bay-map"
import type {
  BayInfo,
  BayPool,
  DiskSmart,
  PoolScan,
  PoolStatus,
  PoolVdevLeaf,
  PveDisk,
  PveSmart,
  PveZfsListEntry,
  PveZfsNode,
  PveZfsTree,
  SmartHealth,
} from "./storage-types"

/** Pull the drive serial out of a ZFS leaf path like
 *  `/dev/disk/by-id/ata-ST8000NM0055-1RM112_ZA13ETCS-part1` -> `ZA13ETCS`. */
export function serialFromByIdPath(path: string): string | undefined {
  const base = path.split("/").pop() ?? path
  const noPart = base.replace(/-part\d+$/, "")
  const underscore = noPart.lastIndexOf("_")
  return underscore >= 0 ? noPart.slice(underscore + 1) : noPart
}

function normalizeHealth(health?: string): SmartHealth {
  if (!health) return "UNKNOWN"
  const h = health.toUpperCase()
  if (h.includes("PASS") || h === "OK") return "PASSED"
  if (h.includes("FAIL")) return "FAILED"
  return "UNKNOWN"
}

function collectLeaves(node: PveZfsNode, out: PveZfsNode[] = []): PveZfsNode[] {
  if (node.leaf === 1) out.push(node)
  else for (const child of node.children ?? []) collectLeaves(child, out)
  return out
}

/**
 * The vdev type, e.g. "raidz3" or "mirror". PVE nests the tree as
 * root → <poolname> → <vdev> → leaves, so search for the first vdev-type node.
 */
const VDEV_NAME = /^(raidz\d|mirror|draid\d?|spare|log|cache)/i
function deriveRaid(tree: PveZfsTree): string {
  function find(node: PveZfsNode): string | undefined {
    for (const child of node.children ?? []) {
      if (VDEV_NAME.test(child.name)) return child.name.replace(/-\d+$/, "")
      const deeper = find(child)
      if (deeper) return deeper
    }
    return undefined
  }
  return find(tree) ?? "single"
}

export function parseScan(scan?: string): PoolScan {
  if (!scan) return { kind: "none", inProgress: false, percent: 100, raw: "" }
  const inProgress = /in progress/i.test(scan)
  const kind: PoolScan["kind"] = /resilver/i.test(scan)
    ? "resilver"
    : /scrub/i.test(scan)
      ? "scrub"
      : "none"
  const m = scan.match(/([\d.]+)%\s*done/i)
  const percent = m ? Number.parseFloat(m[1]) : inProgress ? undefined : 100
  return { kind, inProgress, percent, raw: scan }
}

export function mapPool(tree: PveZfsTree, list?: PveZfsListEntry): PoolStatus {
  const vdevs: PoolVdevLeaf[] = collectLeaves(tree).map((leaf) => ({
    serial: serialFromByIdPath(leaf.name) ?? leaf.name,
    state: leaf.state,
    read: leaf.read,
    write: leaf.write,
    cksum: leaf.cksum,
  }))

  return {
    name: tree.name,
    state: tree.state,
    raid: deriveRaid(tree),
    sizeBytes: list?.size ?? 0,
    allocBytes: list?.alloc ?? 0,
    freeBytes: list?.free ?? 0,
    fragPercent: list?.frag ?? 0,
    scan: parseScan(tree.scan),
    errors: tree.errors ?? "",
    vdevs,
  }
}

/**
 * Build the 12-bay view. Bay→serial comes from the agent's port inventory (stable
 * across drive swaps); identity comes from `disks/list` and pool membership from
 * the pool trees, both keyed by serial.
 */
export function assembleBays(
  disks: PveDisk[],
  poolTrees: PoolStatus[],
  inventory: BayInventoryEntry[]
): BayInfo[] {
  const diskBySerial = new Map<string, PveDisk>()
  for (const d of disks) if (d.serial) diskBySerial.set(d.serial, d)

  const poolBySerial = new Map<string, { pool: BayPool; leaf: PoolVdevLeaf }>()
  for (const pool of poolTrees) {
    for (const leaf of pool.vdevs) {
      poolBySerial.set(leaf.serial, { pool: pool.name as BayPool, leaf })
    }
  }

  const invByBay = new Map(inventory.map((e) => [e.bayIndex, e]))

  return PROXBOX_BAY_MAP.map((slot) => {
    const inv = invByBay.get(slot.bayIndex)
    const present = inv?.present ?? false
    const serial = inv?.serial
    const disk = serial ? diskBySerial.get(serial) : undefined
    const membership = serial ? poolBySerial.get(serial) : undefined

    return {
      bayIndex: slot.bayIndex,
      controller: slot.controller,
      ledCapable: slot.ledCapable,
      occupied: present,
      // Drive seated at the port but the OS/PVE can't enumerate it (link issue).
      offline: present && !disk,
      serial,
      model: disk?.model,
      sizeBytes: disk?.size,
      byIdLink: disk?.by_id_link,
      pool: membership?.pool ?? null,
      smartHealth: normalizeHealth(disk?.health),
      zfsState: membership?.leaf.state,
      zfsErrors: membership
        ? { read: membership.leaf.read, write: membership.leaf.write, cksum: membership.leaf.cksum }
        : undefined,
    }
  })
}

/* ---- SMART ---- */

function rawFirstInt(raw: string): number | undefined {
  const m = raw.match(/-?\d+/)
  return m ? Number.parseInt(m[0], 10) : undefined
}

export function mapSmart(serial: string, raw: PveSmart): DiskSmart {
  const attributes = (raw.attributes ?? []).map((a) => {
    const id = Number.parseInt(a.id.trim(), 10)
    return {
      id,
      name: a.name,
      value: a.value,
      worst: a.worst,
      threshold: a.threshold,
      raw: a.raw,
      rawInt: rawFirstInt(a.raw),
      fail: a.fail,
    }
  })

  const byId = new Map<number, number>()
  for (const a of attributes) if (a.rawInt !== undefined) byId.set(a.id, a.rawInt)
  const attr = (id: number) => byId.get(id)

  return {
    serial,
    health: normalizeHealth(raw.health),
    temperatureC: attr(194) ?? attr(190),
    powerOnHours: attr(9),
    startStopCount: attr(4),
    powerCycleCount: attr(12),
    reallocatedSectors: attr(5),
    pendingSectors: attr(197),
    offlineUncorrectable: attr(198),
    attributes,
  }
}
