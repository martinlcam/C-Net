"use client"

import type { BayInfo, PoolStatus } from "@cnet/engine"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"
import { Backplane } from "./Backplane"
import { DriveDetail } from "./DriveDetail"
import { PoolCard } from "./PoolCard"
import { useBayLive } from "./use-bay-live"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.error || `Request failed (${res.status})`)
  }
  const data = await res.json()
  return data.data
}

/** Banner-only alerting (Phase 1): summarize any pool/drive faults at the top. */
function faultMessages(bays: BayInfo[], pools: PoolStatus[]): string[] {
  const msgs: string[] = []
  for (const p of pools) {
    if (p.state !== "ONLINE") msgs.push(`Pool ${p.name} is ${p.state}`)
    if (p.scan.inProgress && p.scan.kind === "resilver") {
      msgs.push(
        `${p.name} resilvering${p.scan.percent !== undefined ? ` (${p.scan.percent.toFixed(0)}%)` : ""}`
      )
    }
  }
  for (const b of bays) {
    if (b.offline) msgs.push(`Bay ${b.bayIndex} (${b.serial}) seated but offline — reseat`)
    if (b.smartHealth === "FAILED") msgs.push(`Bay ${b.bayIndex} (${b.serial}) SMART FAILED`)
  }
  return msgs
}

export function StorageView() {
  const [selected, setSelected] = useState<BayInfo | null>(null)
  const live = useBayLive()

  const baysQuery = useQuery({
    queryKey: ["storage", "bays"],
    queryFn: () => fetchJson<BayInfo[]>("/proxmox/storage/bays"),
    refetchInterval: 10000,
  })
  const poolsQuery = useQuery({
    queryKey: ["storage", "pools"],
    queryFn: () => fetchJson<PoolStatus[]>("/proxmox/storage/pools"),
    refetchInterval: 10000,
  })

  if (baysQuery.isLoading || poolsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const error = baysQuery.error || poolsQuery.error
  if (error) {
    return (
      <div className="rounded-lg border border-accent-red-30 bg-accent-red-10/10 p-4 text-accent-red-40">
        Error loading storage: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  const bays = baysQuery.data ?? []
  const pools = poolsQuery.data ?? []
  const faults = faultMessages(bays, pools)

  return (
    <div className="space-y-6">
      {faults.length > 0 ? (
        <div className="rounded-lg border border-amber-500/60 bg-amber-950/30 p-3 text-base text-amber-200">
          <span className="font-semibold">Attention: </span>
          {faults.join(" · ")}
        </div>
      ) : null}

      {pools.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {pools.map((p) => (
            <PoolCard key={p.name} pool={p} />
          ))}
        </div>
      ) : null}

      <Backplane
        bays={bays}
        pools={pools}
        live={live}
        selectedBay={selected?.bayIndex}
        onSelect={(b) => setSelected(b)}
      />

      {selected ? (
        <DriveDetail
          bay={selected}
          live={selected.serial ? live.bySerial.get(selected.serial) : undefined}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}
