"use client"

import type { BayInfo, DiskSmart } from "@cnet/engine"
import { useQuery } from "@tanstack/react-query"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

async function fetchSmart(serial: string): Promise<DiskSmart> {
  const res = await fetch(`${API_BASE}/proxmox/storage/disks/${serial}/smart`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to fetch SMART")
  const data = await res.json()
  return data.data
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string | number | undefined
  warn?: boolean
}) {
  return (
    <div className="rounded border border-neutral-80 bg-neutral-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-50">{label}</div>
      <div className={`font-bd-mono text-sm ${warn ? "text-amber-300" : "text-neutral-20"}`}>
        {value ?? "—"}
      </div>
    </div>
  )
}

/** Drive detail with on-demand SMART (only this drive is spun up, never the whole list). */
export function DriveDetail({ bay, onClose }: { bay: BayInfo; onClose: () => void }) {
  const enabled = bay.occupied && !bay.offline && Boolean(bay.serial)
  const {
    data: smart,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["storage", "smart", bay.serial],
    queryFn: () => fetchSmart(bay.serial as string),
    enabled,
  })

  return (
    <div className="rounded-lg border border-primary-purple-60 bg-neutral-100 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-bd-mono text-lg text-neutral-10">
            Bay {bay.bayIndex} · {bay.serial ?? "empty"}
          </h3>
          <span className="text-xs text-neutral-50">
            {bay.model ?? "—"} · {bay.controller.toUpperCase()}
            {bay.pool ? ` · ${bay.pool}` : ""}
            {bay.ledCapable ? "" : " · no locate LED"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-50 hover:text-neutral-20"
          aria-label="Close drive detail"
        >
          ✕
        </button>
      </div>

      {bay.offline ? (
        <p className="text-sm text-amber-300">
          Drive seated but not linking (no SATA connection) — SMART unavailable. Reseat the drive.
        </p>
      ) : !bay.occupied ? (
        <p className="text-sm text-neutral-50">Empty bay.</p>
      ) : isLoading ? (
        <div className="py-6">
          <LoadingSpinner size="md" />
        </div>
      ) : error ? (
        <p className="text-sm text-accent-red-40">
          {error instanceof Error ? error.message : "Failed to load SMART"}
        </p>
      ) : smart ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Health" value={smart.health} warn={smart.health !== "PASSED"} />
          <Stat label="Temp" value={smart.temperatureC ? `${smart.temperatureC}°C` : undefined} />
          <Stat
            label="Power-on"
            value={smart.powerOnHours ? `${smart.powerOnHours} h` : undefined}
          />
          <Stat label="Start/stop" value={smart.startStopCount} />
          <Stat label="Power cycles" value={smart.powerCycleCount} />
          <Stat label="Load cycles" value={smart.attributes.find((a) => a.id === 193)?.rawInt} />
          <Stat
            label="Pending sectors"
            value={smart.pendingSectors}
            warn={(smart.pendingSectors ?? 0) > 0}
          />
          <Stat
            label="Reallocated"
            value={smart.reallocatedSectors}
            warn={(smart.reallocatedSectors ?? 0) > 0}
          />
          <Stat
            label="Offline uncorr."
            value={smart.offlineUncorrectable}
            warn={(smart.offlineUncorrectable ?? 0) > 0}
          />
        </div>
      ) : null}

      {bay.zfsErrors && bay.zfsErrors.read + bay.zfsErrors.write + bay.zfsErrors.cksum > 0 ? (
        <p className="mt-3 text-xs text-amber-300">
          ZFS errors — read {bay.zfsErrors.read}, write {bay.zfsErrors.write}, cksum{" "}
          {bay.zfsErrors.cksum}
        </p>
      ) : null}
    </div>
  )
}
