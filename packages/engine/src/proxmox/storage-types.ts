/*
 * Storage / ZFS bay GUI types. See docs/ZFS_BAY_GUI_PLAN.md.
 *
 * The host (proxbox) has a 12-bay backplane: 8 bays on an LSI HBA (tank_main,
 * raidz3, real locate LED) + 4 bays on AMD AHCI (cold_tank mirror, no locate).
 * These types describe the read-only view assembled from the Proxmox REST API
 * (`disks/list`, `disks/smart`, `disks/zfs/{pool}`) plus the calibrated bay map.
 */

export type BayController = "hba" | "ahci"
export type BayPool = "tank_main" | "cold_tank" | "boot" | null
export type SmartHealth = "PASSED" | "FAILED" | "UNKNOWN"

export interface BayInfo {
  /** Physical slot, 1..12, front view (1-4 top row, 5-8 mid, 9-12 bottom). */
  bayIndex: number
  controller: BayController
  /** Whether a real locate LED can be driven here (HBA only). */
  ledCapable: boolean
  /** A drive is physically present. */
  occupied: boolean
  /** Seated but the OS can't talk to it (no SATA link), e.g. a loose drive. */
  offline: boolean
  serial?: string
  model?: string
  sizeBytes?: number
  byIdLink?: string
  pool: BayPool
  smartHealth: SmartHealth
  /** ZFS vdev state for this drive (ONLINE/DEGRADED/FAULTED/…) when pooled. */
  zfsState?: string
  zfsErrors?: { read: number; write: number; cksum: number }
}

export interface PoolVdevLeaf {
  serial: string
  state: string
  read: number
  write: number
  cksum: number
}

export interface PoolScan {
  kind: "resilver" | "scrub" | "none"
  inProgress: boolean
  /** 0..100 when known; undefined while in progress without a parseable %. */
  percent?: number
  raw: string
}

export interface PoolStatus {
  name: string
  /** ONLINE | DEGRADED | FAULTED | OFFLINE | … */
  state: string
  /** raidz3 | raidz2 | raidz1 | mirror | … (derived from the vdev name). */
  raid: string
  sizeBytes: number
  allocBytes: number
  freeBytes: number
  fragPercent: number
  scan: PoolScan
  errors: string
  vdevs: PoolVdevLeaf[]
}

export interface SmartAttribute {
  id: number
  name: string
  value: number
  worst: number
  threshold: number
  raw: string
  /** First integer parsed out of `raw` (raw strings can be "41 (Min/Max 35/45)"). */
  rawInt?: number
  /** "-" when not failing. */
  fail: string
}

export interface DiskSmart {
  serial: string
  health: SmartHealth
  temperatureC?: number
  powerOnHours?: number
  startStopCount?: number
  powerCycleCount?: number
  reallocatedSectors?: number
  pendingSectors?: number
  offlineUncorrectable?: number
  attributes: SmartAttribute[]
}

/* ---- Raw Proxmox REST response shapes (subset we consume) ---- */

export interface PveDisk {
  devpath: string
  serial?: string
  model?: string
  size?: number
  health?: string
  used?: string
  wwn?: string
  by_id_link?: string
  type?: string
  rpm?: string
}

export interface PveZfsListEntry {
  name: string
  health: string
  size: number
  alloc: number
  free: number
  frag: number
  dedup: number
}

export interface PveZfsNode {
  name: string
  state: string
  read: number
  write: number
  cksum: number
  leaf: number
  msg?: string
  children?: PveZfsNode[]
}

export interface PveZfsTree extends PveZfsNode {
  scan?: string
  errors?: string
}

export interface PveSmartAttribute {
  id: string
  name: string
  value: number
  worst: number
  threshold: number
  raw: string
  fail: string
  flags?: string
  normalized?: number
}

export interface PveSmart {
  health?: string
  type?: string
  attributes?: PveSmartAttribute[]
  text?: string
}
