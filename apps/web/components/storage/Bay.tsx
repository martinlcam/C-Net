"use client"

import type { BayInfo, PoolStatus } from "@cnet/engine"
import { type BayStatus, TONE_STYLES } from "./bay-status"

const POOL_LABEL: Record<string, string> = {
  tank_main: "tank_main",
  cold_tank: "cold_tank",
  boot: "boot",
}

function shortSerial(serial?: string): string {
  if (!serial) return "—"
  // Seagate serials share the ZA13 prefix; the tail is what differs per drive.
  return serial.length > 4 ? serial.slice(-4) : serial
}

function sizeLabel(bytes?: number): string {
  if (!bytes) return ""
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(tb >= 10 ? 0 : 1)}TB`
  return `${Math.round(bytes / 1e9)}GB`
}

interface BayProps {
  bay: BayInfo
  status: BayStatus
  pool?: PoolStatus
  selected?: boolean
  onSelect?: (bay: BayInfo) => void
}

/** One hot-swap drive caddie in the backplane grid. */
export function Bay({ bay, status, selected, onSelect }: BayProps) {
  const tone = TONE_STYLES[status.tone]
  const interactive = Boolean(onSelect)

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelect?.(bay)}
      aria-label={`Bay ${bay.bayIndex}: ${bay.occupied ? (bay.serial ?? "occupied") : "empty"} — ${status.label}`}
      className={[
        "group relative flex h-24 flex-col justify-between rounded-md border p-2 text-left transition",
        tone.caddie,
        interactive ? "cursor-pointer hover:brightness-125" : "cursor-default",
        selected ? "outline outline-2 outline-primary-purple-40" : "",
      ].join(" ")}
    >
      {/* top row: bay number + activity/status LED */}
      <div className="flex items-center justify-between">
        <span className="font-bd-mono text-[10px] text-neutral-50">#{bay.bayIndex}</span>
        <span className={`h-2 w-2 rounded-full ${tone.led}`} aria-hidden />
      </div>

      {/* drive label */}
      <div className="leading-tight">
        {bay.occupied ? (
          <>
            <div className="font-bd-mono text-xs text-neutral-20">{shortSerial(bay.serial)}</div>
            <div className={`text-[10px] ${tone.text}`}>{status.label}</div>
          </>
        ) : (
          <div className="text-[10px] text-neutral-60">empty</div>
        )}
      </div>

      {/* bottom row: pool tag + size */}
      <div className="flex items-center justify-between text-[9px] text-neutral-50">
        <span>{bay.pool ? (POOL_LABEL[bay.pool] ?? bay.pool) : bay.occupied ? "—" : ""}</span>
        <span>{sizeLabel(bay.sizeBytes)}</span>
      </div>

      {!bay.ledCapable && bay.occupied ? (
        <span
          className="absolute right-1 top-5 text-[8px] text-neutral-60"
          title="No locate LED on this controller (AHCI)"
        >
          no-led
        </span>
      ) : null}
    </button>
  )
}
