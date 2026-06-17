"use client"

import type { PoolStatus } from "@cnet/engine"

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

      {/* capacity */}
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

      {/* resilver / scrub */}
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
    </div>
  )
}
