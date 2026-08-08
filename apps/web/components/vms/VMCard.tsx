"use client"

import type { ProxmoxVM } from "@cnet/engine"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { bytes, percent, uptime } from "./format"
import { ACTION_LABELS, type VMAction, vmAction } from "./vm-actions"

const BTN =
  "rounded border border-neutral-70 px-3 py-1.5 text-sm font-medium text-neutral-30 transition hover:border-primary-purple-40 disabled:opacity-40"

const STATUS_STYLES: Record<string, string> = {
  running: "text-accent-green-40 border-accent-green-70/50 bg-accent-green-100/20",
  stopped: "text-neutral-40 border-neutral-70 bg-neutral-90",
  paused: "text-amber-300 border-amber-500/60 bg-amber-950/30",
  suspended: "text-amber-300 border-amber-500/60 bg-amber-950/30",
}

/** Actions offered per status. A stopped guest can only start; a live one can't start again. */
function actionsFor(vm: ProxmoxVM): VMAction[] {
  if (vm.status === "running") return ["shutdown", "reboot", "stop"]
  if (vm.status === "paused" || vm.status === "suspended") return ["start", "stop"]
  return ["start"]
}

/** Everything except `start` interrupts a running workload, so it gets an arm/confirm step. */
function needsConfirm(action: VMAction): boolean {
  return action !== "start"
}

function UsageBar({
  label,
  used,
  total,
  pct,
  detail,
}: {
  label: string
  used?: number
  total?: number
  pct: number
  detail?: string
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-neutral-40">
        <span>{label}</span>
        <span className="font-bd-mono">
          {detail ?? `${bytes(used)} / ${bytes(total)}`} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-90">
        <div
          className={
            pct > 90
              ? "h-full bg-accent-red-60"
              : pct > 75
                ? "h-full bg-amber-500"
                : "h-full bg-primary-purple-40"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function VMCard({ vm }: { vm: ProxmoxVM }) {
  const queryClient = useQueryClient()
  const [armed, setArmed] = useState<VMAction | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (action: VMAction) => vmAction(vm.vmid, action),
    onSuccess: (_, action) => {
      setArmed(null)
      setMsg(`${ACTION_LABELS[action]} queued`)
      // PVE applies the task asynchronously; give it a beat before re-reading status.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["proxmox", "vms"] }), 1500)
    },
    onError: (error) => {
      setArmed(null)
      setMsg(error instanceof Error ? error.message : "Action failed")
    },
  })

  const running = vm.status === "running"
  const cpuPct = running ? Math.min((vm.cpu ?? 0) * 100, 100) : 0
  const memPct = running ? percent(vm.mem, vm.maxmem) : 0
  const diskPct = percent(vm.disk, vm.maxdisk)
  const locked = Boolean(vm.lock)
  const statusClass = STATUS_STYLES[vm.status] ?? STATUS_STYLES.stopped

  const onAction = (action: VMAction) => {
    setMsg(null)
    if (needsConfirm(action) && armed !== action) {
      setArmed(action)
      return
    }
    mutation.mutate(action)
  }

  return (
    <div className="rounded-lg border border-neutral-80 bg-neutral-100 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-bd-mono text-xl text-neutral-10">
            {vm.name || `guest ${vm.vmid}`}
          </h3>
          <span className="text-sm uppercase tracking-wide text-neutral-50">
            {vm.type === "lxc" ? "LXC" : "VM"} {vm.vmid} · {vm.node}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${statusClass}`}
        >
          {vm.status}
        </span>
      </div>

      {vm.tags && vm.tags.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1">
          {vm.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-neutral-70 px-1.5 py-0.5 text-sm text-neutral-50"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <UsageBar
          label="CPU"
          pct={cpuPct}
          detail={`${cpuPct.toFixed(1)}% of ${vm.cpus ?? 0} ${vm.cpus === 1 ? "core" : "cores"}`}
        />
        <UsageBar label="Memory" used={vm.mem} total={vm.maxmem} pct={memPct} />
        {vm.maxdisk ? (
          <UsageBar label="Disk" used={vm.disk} total={vm.maxdisk} pct={diskPct} />
        ) : null}
      </div>

      <div className="mt-3 flex justify-between text-sm text-neutral-50">
        <span>Uptime {uptime(vm.uptime)}</span>
        <span className="font-bd-mono">
          ↓{bytes(vm.netin)} ↑{bytes(vm.netout)}
        </span>
      </div>

      {locked ? (
        <p className="mt-2 text-sm text-amber-300">
          Locked by PVE ({vm.lock}) — actions unavailable
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-80 pt-3">
        {actionsFor(vm).map((action) => {
          const isArmed = armed === action
          const pending = mutation.isPending && mutation.variables === action
          return (
            <button
              key={action}
              type="button"
              disabled={locked || mutation.isPending}
              onClick={() => onAction(action)}
              className={
                isArmed
                  ? `${BTN} border-amber-500 text-amber-300`
                  : action === "stop"
                    ? `${BTN} hover:border-accent-red-60`
                    : BTN
              }
            >
              {pending
                ? "Working…"
                : isArmed
                  ? `Confirm ${ACTION_LABELS[action]}`
                  : ACTION_LABELS[action]}
            </button>
          )
        })}
        {armed ? (
          <button type="button" onClick={() => setArmed(null)} className="text-sm text-neutral-50">
            cancel
          </button>
        ) : null}
      </div>

      {msg ? <p className="mt-2 text-sm text-neutral-50">{msg}</p> : null}
    </div>
  )
}
