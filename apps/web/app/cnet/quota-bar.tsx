"use client"

import { useQuery } from "@tanstack/react-query"
import { formatBytes } from "./dashboard/_components/format"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

type VaultMe = { quotaBytes: number | null; usageBytes: number }

async function fetchVaultMe(): Promise<VaultMe> {
  const res = await fetch(`${API_BASE}/vault/me`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load quota")
  return res.json() as Promise<VaultMe>
}

export function QuotaBar() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vault", "me"],
    queryFn: fetchVaultMe,
    refetchInterval: 60_000,
  })

  if (isLoading || isError || !data || data.quotaBytes === null) return null

  const pct = Math.min(100, Math.round((data.usageBytes / data.quotaBytes) * 100))
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500"

  return (
    <div className="mb-4 space-y-2 rounded-lg border border-neutral-30 bg-neutral-10 p-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-neutral-90">{pct}% used</span>
        <span className="text-neutral-60">{formatBytes(data.quotaBytes)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-30">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-neutral-60 text-xs">
        {formatBytes(data.usageBytes)} of {formatBytes(data.quotaBytes)}
      </p>
    </div>
  )
}
