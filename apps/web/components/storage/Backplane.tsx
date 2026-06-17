"use client"

import type { BayInfo, PoolStatus } from "@cnet/engine"
import { Bay } from "./Bay"
import { deriveBayStatus } from "./bay-status"

interface BackplaneProps {
  bays: BayInfo[]
  pools: PoolStatus[]
  /** Serials currently being located (LED blinking) — Phase 3. */
  locating?: Set<string>
  selectedBay?: number
  onSelect?: (bay: BayInfo) => void
}

/**
 * The proxbox 12-bay backplane, drawn as a head-on chassis (3 rows × 4 cols) to
 * match the physical Supermicro JMCD-12S4. Bays are ordered by physical slot
 * (1–4 top, 5–8 mid, 9–12 bottom); top 8 are HBA/tank_main, bottom 4 AHCI.
 */
export function Backplane({ bays, pools, locating, selectedBay, onSelect }: BackplaneProps) {
  const poolByName = new Map(pools.map((p) => [p.name, p]))
  const ordered = [...bays].sort((a, b) => a.bayIndex - b.bayIndex)

  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-neutral-80 bg-neutral-100 p-3 shadow-inner">
      {/* left rack ear (red, like the chassis handles) */}
      <RackEar />

      <div className="flex-1">
        <div className="grid grid-cols-4 gap-2">
          {ordered.map((bay) => {
            const pool = bay.pool ? poolByName.get(bay.pool) : undefined
            const status = deriveBayStatus(
              bay,
              pool,
              bay.serial ? locating?.has(bay.serial) : false
            )
            return (
              <Bay
                key={bay.bayIndex}
                bay={bay}
                status={status}
                pool={pool}
                selected={selectedBay === bay.bayIndex}
                onSelect={onSelect}
              />
            )
          })}
        </div>

        <div className="mt-2 flex justify-between px-1 text-[9px] uppercase tracking-wider text-neutral-60">
          <span>bays 1–8 · LSI HBA · tank_main (raidz3)</span>
          <span>bays 9–12 · AHCI · cold_tank</span>
        </div>
      </div>

      {/* right rack ear */}
      <RackEar />
    </div>
  )
}

function RackEar() {
  return (
    <div className="flex w-3 flex-col items-center justify-between rounded bg-accent-red-80 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-red-40" />
      <span className="h-8 w-0.5 rounded bg-accent-red-60" />
      <span className="h-1.5 w-1.5 rounded-full bg-accent-red-40" />
    </div>
  )
}
