"use client"

import type { BayInfo, BayLiveState, DiskSmart } from "@cnet/engine"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"
import { type ActionResult, storageAction } from "./storage-actions"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

async function fetchSmart(serial: string): Promise<DiskSmart> {
  const res = await fetch(`${API_BASE}/proxmox/storage/disks/${serial}/smart`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to fetch SMART")
  return (await res.json()).data
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

const BTN = "rounded border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40"

export function DriveDetail({
  bay,
  live,
  onClose,
}: {
  bay: BayInfo
  live?: BayLiveState
  onClose: () => void
}) {
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

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const onDone = (r: ActionResult) => setMsg({ ok: true, text: r.output ?? "done" })
  const onErr = (e: unknown) =>
    setMsg({ ok: false, text: e instanceof Error ? e.message : "failed" })

  const locating = live?.locate ?? false
  const locateMut = useMutation({
    mutationFn: () => storageAction("locate", { serial: bay.serial, on: !locating }),
    onSuccess: onDone,
    onError: onErr,
  })
  const spindownMut = useMutation({
    mutationFn: () => storageAction("spindown", { serial: bay.serial }),
    onSuccess: onDone,
    onError: onErr,
  })

  // Destructive (offline) — typed serial + op password.
  const [showDanger, setShowDanger] = useState(false)
  const [typed, setTyped] = useState("")
  const [pw, setPw] = useState("")
  const offlineMut = useMutation({
    mutationFn: () =>
      storageAction("zpool", {
        action: "offline",
        pool: bay.pool,
        target: bay.serial,
        password: pw,
      }),
    onSuccess: (r) => {
      onDone(r)
      setTyped("")
      setPw("")
    },
    onError: onErr,
  })
  const canOffline = typed === bay.serial && pw.length > 0

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
          aria-label="Close"
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

      {/* Actions */}
      {bay.occupied && !bay.offline ? (
        <div className="mt-4 space-y-2 border-t border-neutral-80 pt-3">
          <div className="flex flex-wrap gap-2">
            {bay.ledCapable ? (
              <button
                type="button"
                disabled={locateMut.isPending}
                onClick={() => locateMut.mutate()}
                className={`${BTN} ${locating ? "border-accent-red-50 text-accent-red-40" : "border-neutral-70 text-neutral-30 hover:border-primary-purple-40"}`}
              >
                {locating ? "Stop locate" : "Locate (blink LED)"}
              </button>
            ) : null}
            {bay.pool !== "tank_main" ? (
              <button
                type="button"
                disabled={spindownMut.isPending}
                onClick={() => spindownMut.mutate()}
                className={`${BTN} border-neutral-70 text-neutral-30 hover:border-primary-purple-40`}
              >
                Spin down
              </button>
            ) : null}
            {bay.pool ? (
              <button
                type="button"
                onClick={() => setShowDanger((s) => !s)}
                className={`${BTN} border-accent-red-70 text-accent-red-40`}
              >
                {showDanger ? "Cancel" : "Offline drive…"}
              </button>
            ) : null}
          </div>

          {showDanger && bay.pool ? (
            <div className="space-y-2 rounded border border-accent-red-70 bg-accent-red-100/20 p-3">
              <p className="text-xs text-accent-red-30">
                Offlining degrades <span className="font-bd-mono">{bay.pool}</span> redundancy. Type
                the serial <span className="font-bd-mono">{bay.serial}</span> and the op password.
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="type serial to confirm"
                className="w-full rounded border border-neutral-70 bg-neutral-100 px-2 py-1 font-bd-mono text-xs text-neutral-20"
              />
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="op password"
                className="w-full rounded border border-neutral-70 bg-neutral-100 px-2 py-1 text-xs text-neutral-20"
              />
              <button
                type="button"
                disabled={!canOffline || offlineMut.isPending}
                onClick={() => offlineMut.mutate()}
                className={`${BTN} w-full border-accent-red-60 bg-accent-red-90/40 text-accent-red-30`}
              >
                {offlineMut.isPending ? "Offlining…" : `Offline ${bay.serial}`}
              </button>
            </div>
          ) : null}

          {msg ? (
            <p className={`text-xs ${msg.ok ? "text-accent-green-40" : "text-accent-red-40"}`}>
              {msg.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
