"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Card } from "@/stories/card/card"
import { poolTone, powerLine, scanSummary, storageState, type Tone, usageTone } from "./display"
import { bytes, percent, uptime } from "./format"
import {
  fetchOverview,
  type ProxmoxOverview as OverviewData,
  OverviewError,
  type OverviewGuest,
  type OverviewStorage,
} from "./overview-api"

/*
 * Read-only view of the proxbox environment, drawn as a rack elevation: a power rail
 * down the left edge takes the UPS's colour, and the node, each container and each
 * storage hang off it as slots. No controls here; the Storage page keeps the actions.
 */

const RAIL: Record<Tone, string> = {
  ok: "bg-accent-green-60",
  warn: "bg-yellow-500",
  bad: "bg-accent-red-60",
  none: "bg-neutral-40",
}
const FILL: Record<Tone, string> = {
  ok: "bg-primary-purple-60",
  warn: "bg-yellow-500",
  bad: "bg-accent-red-60",
  none: "bg-neutral-40",
}
const TEXT: Record<Tone, string> = {
  ok: "text-accent-green-70",
  warn: "text-yellow-600",
  bad: "text-accent-red-70",
  none: "text-neutral-50",
}

export function ProxmoxOverview() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["proxmox", "overview"],
    queryFn: fetchOverview,
    refetchInterval: 15000,
    retry: (count, err) => !(err instanceof OverviewError && err.status < 500) && count < 2,
  })

  if (isLoading) {
    return (
      <Shell tone="none">
        <p className="px-6 py-8 text-neutral-50">Reading the host…</p>
      </Shell>
    )
  }
  if (error || !data) {
    const e = error instanceof OverviewError ? error : null
    const text =
      e?.status === 403
        ? "Only the host owner can see the environment."
        : e?.status === 401
          ? "Sign in to see the host."
          : (e?.message ?? "The host did not answer.")
    return (
      <Shell tone="none">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-6">
          <p className="text-neutral-70">{text}</p>
          {e && e.status >= 500 ? (
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded border border-neutral-30 px-3 py-1 text-neutral-70 text-sm hover:bg-neutral-10"
            >
              Try again
            </button>
          ) : null}
        </div>
      </Shell>
    )
  }

  const power = powerLine(data.ups)
  return (
    <Shell tone={power.tone}>
      <NodeStrip data={data} powerText={power.text} powerTone={power.tone} />
      <Band title="Containers and VMs">
        {data.guests.length === 0 ? (
          <p className="px-6 py-3 text-neutral-50">No guests on this node.</p>
        ) : (
          data.guests.map((g) => <GuestRow key={g.vmid} guest={g} />)
        )}
      </Band>
      <Band title="Storage">
        {data.storages.map((s) => (
          <StorageRow key={s.storage} storage={s} />
        ))}
      </Band>
      <p className="px-6 pt-2 pb-4 text-neutral-50 text-xs tabular-nums">
        Read at {new Date(data.fetchedAt).toLocaleTimeString()}, refreshes every 15 seconds.
      </p>
    </Shell>
  )
}

function Shell({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden pl-1">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${RAIL[tone]}`} />
      {children}
    </Card>
  )
}

function NodeStrip({
  data,
  powerText,
  powerTone,
}: {
  data: OverviewData
  powerText: string
  powerTone: Tone
}) {
  const n = data.node
  const mem = percent(n.memoryUsed, n.memoryTotal)
  const root = percent(n.rootUsed, n.rootTotal)
  return (
    <div className="border-neutral-30 border-b px-6 pt-5 pb-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-semibold text-2xl text-primary-purple-70">{n.name}</h2>
        <span className="text-neutral-70 tabular-nums">up {uptime(n.uptimeSeconds)}</span>
        <span className={`${TEXT[powerTone]} ml-auto`}>{powerText}</span>
      </div>
      <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
        <Gauge label="CPU" value={n.cpuPercent} detail={`${n.cpuCores} cores`} />
        <Gauge
          label="Memory"
          value={mem}
          detail={`${bytes(n.memoryUsed)} of ${bytes(n.memoryTotal)}`}
        />
        <Gauge
          label="Root disk"
          value={root}
          detail={`${bytes(n.rootUsed)} of ${bytes(n.rootTotal)}`}
        />
      </div>
    </div>
  )
}

function Gauge({ label, value, detail }: { label: string; value: number; detail: string }) {
  const tone = usageTone(value)
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-70">{label}</span>
        <span className="text-neutral-100 tabular-nums">{Math.round(value)}%</span>
      </div>
      <Bar value={value} tone={tone} />
      <p className="mt-1 text-neutral-50 text-xs tabular-nums">{detail}</p>
    </div>
  )
}

function Bar({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-20">
      <div
        className={`h-full ${FILL[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function Band({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-neutral-30 border-b">
      <h3 className="px-6 pt-4 pb-1 font-medium text-neutral-70 text-sm">{title}</h3>
      <div className="pb-2">{children}</div>
    </section>
  )
}

function GuestRow({ guest }: { guest: OverviewGuest }) {
  const [open, setOpen] = useState(false)
  const running = guest.status === "running"
  const cpu = running && guest.cpu !== null ? guest.cpu * 100 : 0
  const mem = percent(guest.mem, guest.maxmem)
  const disk = percent(guest.disk, guest.maxdisk)
  return (
    <div className={running ? "" : "opacity-60"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_3rem_1fr] items-center gap-x-3 px-6 py-2 text-left hover:bg-neutral-10 sm:grid-cols-[auto_3rem_minmax(8rem,1.4fr)_5rem_minmax(6rem,1fr)_minmax(6rem,1fr)_8rem]"
      >
        <span
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full border-2 ${running ? "border-accent-green-60 bg-accent-green-60" : "border-neutral-40"}`}
        />
        <span className="sr-only">{running ? "running" : guest.status}</span>
        <span className="text-neutral-50 tabular-nums">{guest.vmid}</span>
        <span className="truncate text-neutral-100">
          {guest.name || "unnamed"}
          <span className="ml-2 text-neutral-50 text-xs">
            {guest.type === "qemu" ? "VM" : "container"}
          </span>
        </span>
        <span className="hidden text-neutral-70 text-sm tabular-nums sm:block">
          {running ? uptime(guest.uptimeSeconds) : guest.status}
        </span>
        <Cell label="mem" value={mem} text={bytes(guest.mem)} />
        <Cell label="disk" value={disk} text={bytes(guest.disk)} />
        <span className="hidden text-neutral-70 text-sm tabular-nums sm:block">
          {guest.ips[0] ?? ""}
        </span>
      </button>
      {open ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 bg-neutral-10 px-6 py-3 text-sm sm:grid-cols-4 sm:pl-[4.5rem]">
          <Fact
            k="CPU"
            v={running ? `${cpu.toFixed(1)}% of ${guest.cpus ?? "?"} cores` : "stopped"}
          />
          <Fact k="Memory" v={`${bytes(guest.mem)} of ${bytes(guest.maxmem)}`} />
          <Fact k="Disk" v={`${bytes(guest.disk)} of ${bytes(guest.maxdisk)}`} />
          <Fact k="Network" v={`${bytes(guest.netin)} in, ${bytes(guest.netout)} out`} />
          {guest.ips.length > 0 ? <Fact k="Addresses" v={guest.ips.join(", ")} /> : null}
        </dl>
      ) : null}
    </div>
  )
}

function Cell({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <span className="hidden sm:block">
      <span className="flex justify-between text-neutral-50 text-xs">
        <span>{label}</span>
        <span className="tabular-nums">{text}</span>
      </span>
      <Bar value={value} tone={usageTone(value)} />
    </span>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-neutral-50 text-xs">{k}</dt>
      <dd className="text-neutral-100 tabular-nums">{v}</dd>
    </div>
  )
}

function StorageRow({ storage }: { storage: OverviewStorage }) {
  const used = percent(storage.used, storage.total)
  const pool = storage.pool
  const tone: Tone = !storage.active ? "none" : pool ? poolTone(pool.state) : usageTone(used)
  const state = storageState(storage)
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 px-6 py-2 sm:grid-cols-[auto_minmax(8rem,1.4fr)_7rem_minmax(10rem,2fr)_8rem]">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${RAIL[tone]}`} />
      <span className="truncate text-neutral-100">
        {storage.storage}
        <span className="ml-2 text-neutral-50 text-xs">{storage.type}</span>
      </span>
      <span className={`hidden text-sm sm:block ${TEXT[tone]}`}>{state}</span>
      <span className="hidden sm:block">
        {storage.active && storage.total ? (
          <>
            <span className="flex justify-between text-neutral-50 text-xs tabular-nums">
              <span>{bytes(storage.used)} used</span>
              <span>{bytes(storage.total)}</span>
            </span>
            <Bar value={used} tone={tone === "none" ? "none" : usageTone(used)} />
          </>
        ) : null}
      </span>
      <span className="hidden text-neutral-50 text-xs sm:block">
        {pool ? scanSummary(pool.scan) : ""}
      </span>
    </div>
  )
}
