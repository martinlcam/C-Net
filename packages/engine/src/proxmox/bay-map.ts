/*
 * Calibrated 12-bay map for host `proxbox`, keyed by PHYSICAL PORT (by-path), so
 * whatever drive is plugged into a bay is shown as that bay regardless of serial.
 * Established 2026-06-16, re-keyed to by-path 2026-06-18. See docs/ZFS_BAY_GUI_PLAN.md.
 *
 *   bays 1–8  → LSI HBA  pci-0000:03:00.0-sas-phy{7..0}-lun-0   (tank_main, locate LED)
 *   bays 9–12 → AMD AHCI pci-0000:{07,08}:00.0-ata-N            (cold_tank, no locate)
 *
 * Only the host can resolve a by-path to a /dev node, so cnet-bayd builds the live
 * inventory (port → current drive) and the API serves it. by-path is stable per
 * backplane slot across drive swaps and reboots (unlike serial or /dev/sdX).
 */

import type { BayController } from "./storage-types"

export interface BaySlot {
  bayIndex: number
  controller: BayController
  ledCapable: boolean
  /** Stable port: /dev/disk/by-path/<byPath>. */
  byPath: string
}

export const PROXBOX_NODE = "proxbox"

/** Redis key under which cnet-bayd publishes the current port→drive inventory. */
export const BAY_INVENTORY_KEY = "bay:inventory"

/** How stale (ms) the inventory may be before the API treats the agent as down. */
export const BAY_INVENTORY_MAX_AGE_MS = 30_000

export interface BayInventoryEntry {
  bayIndex: number
  byPath: string
  present: boolean
  serial?: string
  devPath?: string
}

export interface BayInventory {
  ts: number
  bays: BayInventoryEntry[]
}

export const PROXBOX_BAY_MAP: readonly BaySlot[] = [
  { bayIndex: 1, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy7-lun-0" },
  { bayIndex: 2, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy6-lun-0" },
  { bayIndex: 3, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy5-lun-0" },
  { bayIndex: 4, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy4-lun-0" },
  { bayIndex: 5, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy3-lun-0" },
  { bayIndex: 6, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy2-lun-0" },
  { bayIndex: 7, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy1-lun-0" },
  { bayIndex: 8, controller: "hba", ledCapable: true, byPath: "pci-0000:03:00.0-sas-phy0-lun-0" },
  { bayIndex: 9, controller: "ahci", ledCapable: false, byPath: "pci-0000:07:00.0-ata-4" },
  { bayIndex: 10, controller: "ahci", ledCapable: false, byPath: "pci-0000:08:00.0-ata-5" },
  { bayIndex: 11, controller: "ahci", ledCapable: false, byPath: "pci-0000:08:00.0-ata-1" },
  { bayIndex: 12, controller: "ahci", ledCapable: false, byPath: "pci-0000:07:00.0-ata-3" },
] as const

export const SLOT_BY_BAY: ReadonlyMap<number, BaySlot> = new Map(
  PROXBOX_BAY_MAP.map((s) => [s.bayIndex, s])
)
