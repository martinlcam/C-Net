"use client"

import type { PoolStatus } from "@cnet/engine"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { storageAction } from "./storage-actions"

function tb(bytes: number): string {
  return `${(bytes / 1e12).toFixed(2)} TB`
}

const STATE_STYLES: Record<string, string> = {
  ONLINE: "text-accent-green-40 border-accent-green-70/50 bg-accent-green-100/20",
  DEGRADED: "text-amber-300 border-amber-500/60 bg-amber-950/30",
  FAULTED: "text-accent-red-40 border-accent-red-60 bg-accent-red-100/30",
}

export function PoolCard({ pool }: { pool: PoolStatus }) {
  const usedPct = pool.sizeBytes > 0 ? (pool.allocBytes / pool.sizeBytes) * 100 : 0
  const stateClass = STATE_STYLES[pool.state] ?? "text-neutral-30 border-neutral-70 bg-neutral-100"
  const scan = pool.scan

  const [msg, setMsg] = useState<string | null>(null)
  const scrubMut = useMutation({
    mutationFn: () => storageAction("zpool", { action: "scrub", pool: pool.name }),
    onSuccess: (r) => setMsg(r.output ?? "scrub started"),
    onError: (e) => setMsg(e instanceof Error ? e.message : "failed"),
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

      <div className="mt-3 flex items-center gap-3 border-t border-neutral-80 pt-3">
        <button
          type="button"
          disabled={scan.inProgress || scrubMut.isPending}
          onClick={() => scrubMut.mutate()}
          className="rounded border border-neutral-70 px-3 py-1.5 text-xs font-medium text-neutral-30 transition hover:border-primary-purple-40 disabled:opacity-40"
        >
          {scrubMut.isPending ? "Starting…" : "Scrub"}
        </button>
        {msg ? <span className="text-xs text-neutral-50">{msg}</span> : null}
      </div>
    </div>
  )
}
