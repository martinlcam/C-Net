/*
 * Calibrated 12-bay map for host `proxbox`. Established 2026-06-16 by blinking
 * each HBA locate LED (`ledctl`) and recording which physical slot lit, plus the
 * read-IO activity trick for the no-LED AHCI bays. See docs/ZFS_BAY_GUI_PLAN.md §4a.
 *
 *   bay  1: ZA13JWR6   2: ZA13JWVH   3: ZA13JX1J   4: ZA13JWV9   (HBA / tank_main)
 *   bay  5: ZA13EQFX   6: ZA13HXER   7: ZA13ETKN   8: ZA13ETCS   (HBA / tank_main)
 *   bay  9: ZA136AR3  10: <empty>   11: ZA13EK55  12: ZA13KGFQ   (AHCI / cold_tank)
 *
 * Keyed/rendered by physical bay; occupancy + identity are resolved at runtime
 * from `disks/list` by matching `expectedSerial`. Bay 9's drive is seated but
 * won't link (loose), so it never enumerates — flagged `offlineKnown` so the UI
 * shows "occupied · offline" instead of "empty".
 */

import type { BayController } from "./storage-types"

export interface BaySlot {
  bayIndex: number
  controller: BayController
  ledCapable: boolean
  /** The drive we expect in this slot (for stable rendering + offline bays). */
  expectedSerial?: string
  /** Seated but unreachable by the OS (no SATA link); render as occupied-offline. */
  offlineKnown?: boolean
}

export const PROXBOX_NODE = "proxbox"

export const PROXBOX_BAY_MAP: readonly BaySlot[] = [
  { bayIndex: 1, controller: "hba", ledCapable: true, expectedSerial: "ZA13JWR6" },
  { bayIndex: 2, controller: "hba", ledCapable: true, expectedSerial: "ZA13JWVH" },
  { bayIndex: 3, controller: "hba", ledCapable: true, expectedSerial: "ZA13JX1J" },
  { bayIndex: 4, controller: "hba", ledCapable: true, expectedSerial: "ZA13JWV9" },
  { bayIndex: 5, controller: "hba", ledCapable: true, expectedSerial: "ZA13EQFX" },
  { bayIndex: 6, controller: "hba", ledCapable: true, expectedSerial: "ZA13HXER" },
  { bayIndex: 7, controller: "hba", ledCapable: true, expectedSerial: "ZA13ETKN" },
  { bayIndex: 8, controller: "hba", ledCapable: true, expectedSerial: "ZA13ETCS" },
  {
    bayIndex: 9,
    controller: "ahci",
    ledCapable: false,
    expectedSerial: "ZA136AR3",
    offlineKnown: true,
  },
  { bayIndex: 10, controller: "ahci", ledCapable: false },
  { bayIndex: 11, controller: "ahci", ledCapable: false, expectedSerial: "ZA13EK55" },
  { bayIndex: 12, controller: "ahci", ledCapable: false, expectedSerial: "ZA13KGFQ" },
] as const

/** serial -> bay slot, for reverse lookups (e.g. when locating a drive). */
export const BAY_BY_SERIAL: ReadonlyMap<string, BaySlot> = new Map(
  PROXBOX_BAY_MAP.filter((b) => b.expectedSerial).map((b) => [b.expectedSerial as string, b])
)
