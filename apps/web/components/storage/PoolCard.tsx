"use client"

import type { DiskSmart, PoolStatus } from "@cnet/engine"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { storageAction } from "./storage-actions"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

function tb(bytes: number): string {
  return `${(bytes / 1e12).toFixed(2)} TB`
}

const STATE_STYLES: Record<string, string> = {
  ONLINE: "text-accent-green-40 border-accent-green-70/50 bg-accent-green-100/20",
  DEGRADED: "text-amber-300 border-amber-500/60 bg-amber-950/30",
  FAULTED: "text-accent-red-40 border-accent-red-60 bg-accent-red-100/30",
}

const BTN =
  "rounded border border-neutral-70 px-3 py-1.5 text-xs font-medium text-neutral-30 transition hover:border-primary-purple-40 disabled:opacity-40"

type PoolSmartRow = DiskSmart | { serial: string; error: string }

export function PoolCard({ pool }: { pool: PoolStatus }) {
  const usedPct = pool.sizeBytes > 0 ? (pool.allocBytes / pool.sizeBytes) * 100 : 0
  const stateClass = STATE_STYLES[pool.state] ?? "text-neutral-30 border-neutral-70 bg-neutral-100"
  const scan = pool.scan

  const [msg, setMsg] = useState<string | null>(null)
  const [confirmSpin, setConfirmSpin] = useState(false)
  const [smartOpen, setSmartOpen] = useState(false)

  const scrubMut = useMutation({
    mutationFn: () => storageAction("zpool", { action: "scrub", pool: pool.name }),
    onSuccess: (r) => setMsg(r.output ?? "scrub started"),
    onError: (e) => setMsg(e instanceof Error ? e.message : "failed"),
  })
  const spindownMut = useMutation({
    mutationFn: () => storageAction("spindown", { pool: pool.name }),
    onSuccess: (r) => {
      setMsg(r.output ?? "spun down")
      setConfirmSpin(false)
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "failed"),
  })
  const smartQuery = useQuery({
    queryKey: ["storage", "poolsmart", pool.name],
    queryFn: (): Promise<PoolSmartRow[]> =>
      fetch(`${API_BASE}/proxmox/storage/pools/${pool.name}/smart`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => d.data),
    enabled: smartOpen,
  })

  return (
    <div className="rounded-lg border border-neutral-80 bg-neutral-100 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bd-mono text-lg text-neutral-10">{pool.name}</h3>
          <span className="text-xs uppercase tracking-wide text-neutral-50">
            {pool.raid} · {pool.vdevs.length} drives
          </span>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stateClass}`}>
          {pool.state}
        </span>
      </div>

      <div className="mb-1 flex justify-between text-xs text-neutral-40">
        <span>
          {tb(pool.allocBytes)} / {tb(pool.sizeBytes)}
        </span>
        <span>
          {usedPct.toFixed(1)}% · {pool.fragPercent}% frag
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-90">
        <div
          className={usedPct > 90 ? "h-full bg-accent-red-60" : "h-full bg-primary-purple-40"}
          style={{ width: `${Math.min(usedPct, 100)}%` }}
        />
      </div>

      {scan.inProgress ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="capitalize text-secondary-blue-40">{scan.kind} in progress</span>
            {scan.percent !== undefined ? (
              <span className="text-secondary-blue-40">{scan.percent.toFixed(1)}%</span>
            ) : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-90">
            <div
              className="h-full animate-pulse bg-secondary-blue-50"
              style={{ width: `${scan.percent ?? 100}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-neutral-50">{scan.raw || "No recent scrub/resilver"}</p>
      )}

      {pool.errors && pool.errors !== "No known data errors" ? (
        <p className="mt-2 text-xs text-accent-red-40">{pool.errors}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-80 pt-3">
        <button
          type="button"
          disabled={scan.inProgress || scrubMut.isPending}
          onClick={() => scrubMut.mutate()}
          className={BTN}
        >
          {scrubMut.isPending ? "Starting…" : "Scrub"}
        </button>

        <button type="button" onClick={() => setSmartOpen((s) => !s)} className={BTN}>
          {smartOpen ? "Hide SMART" : "SMART all"}
        </button>

        {confirmSpin ? (
          <button
            type="button"
            disabled={spindownMut.isPending}
            onClick={() => spindownMut.mutate()}
            className={`${BTN} border-amber-500 text-amber-300`}
          >
            {spindownMut.isPending ? "Spinning down…" : `Confirm spin down ${pool.name}`}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmSpin(true)} className={BTN}>
            Spin down pool
          </button>
        )}
        {confirmSpin ? (
          <button
            type="button"
            onClick={() => setConfirmSpin(false)}
            className="text-xs text-neutral-50"
          >
            cancel
          </button>
        ) : null}
      </div>

      {msg ? <p className="mt-2 text-xs text-neutral-50">{msg}</p> : null}

      {smartOpen ? (
        <div className="mt-3 overflow-x-auto">
          {smartQuery.isLoading ? (
            <p className="text-xs text-neutral-50">Reading SMART…</p>
          ) : smartQuery.error ? (
            <p className="text-xs text-accent-red-40">Failed to load SMART</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="text-neutral-50">
                <tr>
                  <th className="py-1 pr-2 font-medium">Serial</th>
                  <th className="pr-2 font-medium">Health</th>
                  <th className="pr-2 font-medium">Temp</th>
                  <th className="pr-2 font-medium">Pwr-on</th>
                  <th className="pr-2 font-medium">Pending</th>
                  <th className="font-medium">Realloc</th>
                </tr>
              </thead>
              <tbody className="font-bd-mono text-neutral-20">
                {(smartQuery.data ?? []).map((row) =>
                  "error" in row ? (
                    <tr key={row.serial}>
                      <td className="py-0.5 pr-2">{row.serial}</td>
                      <td className="text-accent-red-40" colSpan={5}>
                        {row.error}
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.serial}>
                      <td className="py-0.5 pr-2">{row.serial}</td>
                      <td
                        className={
                          row.health === "PASSED" ? "text-accent-green-40" : "text-accent-red-40"
                        }
                      >
                        {row.health}
                      </td>
                      <td className="pr-2">{row.temperatureC ? `${row.temperatureC}°C` : "—"}</td>
                      <td className="pr-2">{row.powerOnHours ? `${row.powerOnHours}h` : "—"}</td>
                      <td className={(row.pendingSectors ?? 0) > 0 ? "text-amber-300" : "pr-2"}>
                        {row.pendingSectors ?? 0}
                      </td>
                      <td className={(row.reallocatedSectors ?? 0) > 0 ? "text-amber-300" : ""}>
                        {row.reallocatedSectors ?? 0}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}
