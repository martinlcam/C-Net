"use client"

import type { ProxmoxVM } from "@cnet/engine"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"
import { bytes } from "./format"
import { VMCard } from "./VMCard"
import { fetchVMs } from "./vm-actions"

type StatusFilter = "all" | "running" | "stopped"
type TypeFilter = "all" | "lxc" | "qemu"

const CHIP = "rounded border px-2.5 py-1 text-sm font-medium transition"
const CHIP_ON = "border-primary-purple-40 bg-primary-purple-40/10 text-primary-purple-40"
const CHIP_OFF = "border-neutral-70 text-neutral-50 hover:text-neutral-30"

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-80 bg-neutral-100 p-3">
      <div className="text-sm uppercase tracking-wide text-neutral-50">{label}</div>
      <div className="font-bd-mono text-2xl text-neutral-10">{value}</div>
      {hint ? <div className="text-sm text-neutral-50">{hint}</div> : null}
    </div>
  )
}

/** Totals are drawn from running guests only — a stopped guest reserves nothing. */
function summarize(vms: ProxmoxVM[]) {
  const running = vms.filter((v) => v.status === "running")
  return {
    total: vms.length,
    running: running.length,
    stopped: vms.length - running.length,
    cores: running.reduce((sum, v) => sum + (v.cpus ?? 0), 0),
    memUsed: running.reduce((sum, v) => sum + (v.mem ?? 0), 0),
    memMax: running.reduce((sum, v) => sum + (v.maxmem ?? 0), 0),
  }
}

export function VMsView() {
  const [status, setStatus] = useState<StatusFilter>("all")
  const [type, setType] = useState<TypeFilter>("all")
  const [search, setSearch] = useState("")

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["proxmox", "vms"],
    queryFn: fetchVMs,
    refetchInterval: 10000,
  })

  const vms = useMemo(() => data ?? [], [data])
  const stats = useMemo(() => summarize(vms), [vms])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vms.filter((vm) => {
      if (status === "running" && vm.status !== "running") return false
      if (status === "stopped" && vm.status === "running") return false
      if (type !== "all" && (vm.type ?? "qemu") !== type) return false
      if (!q) return true
      return (
        (vm.name ?? "").toLowerCase().includes(q) ||
        String(vm.vmid).includes(q) ||
        (vm.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [vms, status, type, search])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-accent-red-30 bg-accent-red-10/10 p-4 text-accent-red-40">
        Error loading guests: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Guests" value={String(stats.total)} hint={`${stats.stopped} stopped`} />
        <Stat label="Running" value={String(stats.running)} />
        <Stat label="vCPU allocated" value={String(stats.cores)} hint="across running guests" />
        <Stat
          label="Memory"
          value={bytes(stats.memUsed)}
          hint={`of ${bytes(stats.memMax)} allocated`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ID or tag…"
          className="min-w-0 flex-1 rounded border border-neutral-70 bg-neutral-100 px-3 py-1.5 text-base text-neutral-10 placeholder:text-neutral-50 focus:border-primary-purple-40 focus:outline-none sm:max-w-xs"
        />

        <div className="flex gap-1">
          {(["all", "running", "stopped"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`${CHIP} ${status === s ? CHIP_ON : CHIP_OFF}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(["all", "lxc", "qemu"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`${CHIP} ${type === t ? CHIP_ON : CHIP_OFF}`}
            >
              {t === "all" ? "any type" : t}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className={`${CHIP} ${CHIP_OFF} ml-auto`}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-xl text-neutral-50">
          {vms.length === 0 ? "No VMs or containers found" : "No guests match these filters"}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((vm) => (
            <VMCard key={`${vm.node}-${vm.vmid}`} vm={vm} />
          ))}
        </div>
      )}
    </div>
  )
}
