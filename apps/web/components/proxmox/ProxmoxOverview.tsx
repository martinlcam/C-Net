"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { Card } from "@/stories/card/card"
import { Battery } from "./Battery"
import { poolTone, powerLine, scanSummary, storageState, type Tone, usageTone } from "./display"
import { EventStrip } from "./EventStrip"
import { bytes, percent, uptime } from "./format"
import { LoadDial } from "./LoadDial"
import { type BatteryModel, batteryModel, type LiveFrame, type LiveUps, netRate } from "./live"
import {
  fetchOverview,
  type ProxmoxOverview as OverviewData,
  OverviewError,
  type OverviewGuest,
  type OverviewStorage,
  type OverviewUps,
} from "./overview-api"
import { Sparkline } from "./Sparkline"
import { useHostLive } from "./use-host-live"

/*
 * Read-only view of the proxbox environment, drawn as a rack elevation: a power rail down
 * the left edge takes the UPS's colour, and the node, each container and each storage hang
 * off it as slots. Identity and storage come from the REST overview every 15 s; what moves
 * (CPU, memory, network, the UPS) comes from the host agent's 2 s frames, with the last
 * three minutes replayed on load so the sparklines are full on arrival.
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
const BATTERY_TONE: Record<BatteryModel["mode"], Tone> = {
  full: "ok",
  charging: "ok",
  draining: "warn",
  critical: "bad",
  unknown: "none",
}
const SPRING = { type: "spring", stiffness: 80, damping: 20 } as const

/** The REST snapshot's UPS reading in the live frame's shape, for before a frame arrives. */
function liveUpsFromRest(ups: OverviewUps | null): LiveUps | null {
  if (!ups) return null
  const nominal =
    ups.loadWatts !== null && ups.loadPercent
      ? Math.round(ups.loadWatts / (ups.loadPercent / 100))
      : null
  return { ...ups, nominalWatts: nominal }
}

export function ProxmoxOverview() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["proxmox", "overview"],
    queryFn: fetchOverview,
    refetchInterval: 15000,
    retry: (count, err) => !(err instanceof OverviewError && err.status < 500) && count < 2,
  })
  const live = useHostLive(Boolean(data))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])

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

  const latest = live.latest
  const ups = latest ? latest.ups : liveUpsFromRest(data.ups)
  const battery = batteryModel(ups, live.frames)
  const power = powerLine(ups)
  return (
    <Shell tone={BATTERY_TONE[battery.mode]}>
      <NodeStrip
        data={data}
        latest={latest}
        ups={ups}
        battery={battery}
        powerText={power.text}
        connected={live.connected}
      />
      <EventStrip events={live.events} now={now} />
      <Band title="Containers and VMs">
        {data.guests.length === 0 ? (
          <p className="px-6 py-3 text-neutral-50">No guests on this node.</p>
        ) : (
          data.guests.map((g) => <GuestRow key={g.vmid} guest={g} frames={live.frames} />)
        )}
      </Band>
      <Band title="Storage">
        {data.storages.map((s) => (
          <StorageRow key={s.storage} storage={s} />
        ))}
      </Band>
      <p className="px-6 pt-2 pb-4 text-neutral-50 text-xs tabular-nums">
        {live.connected
          ? `Live, ${live.frames.length * 2} s of history. Storage read at ${new Date(data.fetchedAt).toLocaleTimeString()}.`
          : `Read at ${new Date(data.fetchedAt).toLocaleTimeString()}, refreshes every 15 seconds.`}
      </p>
    </Shell>
  )
}

function Shell({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const still = useReducedMotion()
  const breathing = !still && tone !== "none"
  return (
    <Card className="relative overflow-hidden pl-1">
      <motion.span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${RAIL[tone]}`}
        initial={false}
        animate={breathing ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
        transition={
          breathing
            ? { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
            : { duration: 0 }
        }
      />
      {children}
    </Card>
  )
}

/** A number that glides to its new value instead of jumping. */
function Num({
  value,
  digits = 0,
  suffix = "",
}: {
  value: number
  digits?: number
  suffix?: string
}) {
  const still = useReducedMotion()
  const mv = useMotionValue(value)
  const [text, setText] = useState(() => value.toFixed(digits))
  useEffect(() => {
    if (still) {
      setText(value.toFixed(digits))
      return
    }
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setText(v.toFixed(digits)),
    })
    return () => controls.stop()
  }, [value, digits, still, mv])
  return (
    <span className="tabular-nums">
      {text}
      {suffix}
    </span>
  )
}

function NodeStrip({
  data,
  latest,
  ups,
  battery,
  powerText,
  connected,
}: {
  data: OverviewData
  latest: LiveFrame | null
  ups: LiveUps | null
  battery: BatteryModel
  powerText: string
  connected: boolean
}) {
  const n = data.node
  const cpuPercent = latest ? latest.node.cpu * 100 : n.cpuPercent
  const memUsed = latest ? latest.node.mem : n.memoryUsed
  const memTotal = latest ? latest.node.maxmem : n.memoryTotal
  const up = latest ? latest.node.uptimeSeconds : n.uptimeSeconds
  const root = percent(n.rootUsed, n.rootTotal)
  const nominal = ups?.nominalWatts ?? 900
  const tone = BATTERY_TONE[battery.mode]
  return (
    <div className="border-neutral-30 border-b px-6 pt-5 pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-semibold text-2xl text-primary-purple-70">{n.name}</h2>
        <span className="text-neutral-70 tabular-nums">up {uptime(up)}</span>
        {connected ? (
          <span className="flex items-center gap-1 text-neutral-50 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green-60" aria-hidden />
            live
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <Battery model={battery} />
          <LoadDial watts={ups?.loadWatts ?? null} nominal={nominal} />
          <div className="text-right">
            <p className={`${TEXT[tone]} text-sm`}>{powerText}</p>
            <p className="text-neutral-50 text-xs tabular-nums">
              {ups && ups.loadWatts !== null ? (
                <>
                  <Num value={ups.loadWatts} suffix=" W" /> of {nominal} W
                  {battery.drainPercentPerMinute !== null
                    ? `, draining ${battery.drainPercentPerMinute.toFixed(1)}% a minute`
                    : ""}
                </>
              ) : (
                "no load reading"
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
        <Gauge label="CPU" value={cpuPercent} detail={`${n.cpuCores} cores`} />
        <Gauge
          label="Memory"
          value={percent(memUsed, memTotal)}
          detail={`${bytes(memUsed)} of ${bytes(memTotal)}`}
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
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-70">{label}</span>
        <span className="text-neutral-100">
          <Num value={value} suffix="%" />
        </span>
      </div>
      <Bar value={value} tone={usageTone(value)} />
      <p className="mt-1 text-neutral-50 text-xs tabular-nums">{detail}</p>
    </div>
  )
}

function Bar({ value, tone }: { value: number; tone: Tone }) {
  const still = useReducedMotion()
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-20">
      <motion.div
        className={`h-full ${FILL[tone]}`}
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={still ? { duration: 0 } : SPRING}
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

function GuestRow({ guest, frames }: { guest: OverviewGuest; frames: LiveFrame[] }) {
  const [open, setOpen] = useState(false)
  const still = useReducedMotion()
  const latest = frames[frames.length - 1]
  const liveGuest = latest?.guests.find((g) => g.vmid === guest.vmid)
  const status = liveGuest?.status ?? guest.status
  const running = status === "running"
  const cpu = running ? (liveGuest ? liveGuest.cpu : (guest.cpu ?? 0)) * 100 : 0
  const memUsed = liveGuest ? liveGuest.mem : guest.mem
  const memMax = liveGuest ? liveGuest.maxmem : guest.maxmem
  const mem = percent(memUsed, memMax)
  const disk = percent(guest.disk, guest.maxdisk)
  const up = liveGuest ? liveGuest.uptimeSeconds : guest.uptimeSeconds
  const net = useMemo(() => {
    const out: number[] = []
    for (let i = 1; i < frames.length; i++) {
      const r = netRate(frames[i - 1], frames[i], guest.vmid)
      out.push(r.inBps + r.outBps)
    }
    return out
  }, [frames, guest.vmid])
  const netNow = net[net.length - 1] ?? 0
  // The pulse is the CPU: wider and quicker the busier the guest.
  const pulse = Math.min(1, cpu / 100)
  return (
    <motion.div
      initial={false}
      animate={{ opacity: running ? 1 : 0.6 }}
      transition={still ? { duration: 0 } : { duration: 0.4 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_3rem_1fr] items-center gap-x-3 px-6 py-2 text-left hover:bg-neutral-10 sm:grid-cols-[auto_3rem_minmax(8rem,1.4fr)_5rem_minmax(6rem,1fr)_minmax(6rem,1fr)_6.5rem_8rem]"
      >
        <span className="relative flex h-3 w-3 items-center justify-center">
          {running && !still ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent-green-60"
              animate={{ scale: [1, 1 + pulse * 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{
                duration: Math.max(0.6, 2.4 - pulse * 1.6),
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeOut",
              }}
            />
          ) : null}
          <span
            aria-hidden
            className={`relative h-2.5 w-2.5 rounded-full border-2 ${running ? "border-accent-green-60 bg-accent-green-60" : "border-neutral-40"}`}
          />
          <span className="sr-only">{running ? "running" : status}</span>
        </span>
        <span className="text-neutral-50 tabular-nums">{guest.vmid}</span>
        <span className="truncate text-neutral-100">
          {guest.name || "unnamed"}
          <span className="ml-2 text-neutral-50 text-xs">
            {guest.type === "qemu" ? "VM" : "container"}
          </span>
        </span>
        <span className="hidden text-neutral-70 text-sm tabular-nums sm:block">
          {running ? uptime(up) : status}
        </span>
        <Cell label="mem" value={mem} text={bytes(memUsed)} />
        <Cell label="disk" value={disk} text={bytes(guest.disk)} />
        <span className="hidden sm:block">
          <span className="flex justify-between text-neutral-50 text-xs">
            <span>net</span>
            <span className="tabular-nums">{bytes(netNow)}/s</span>
          </span>
          <Sparkline
            values={net}
            width={96}
            height={16}
            label={`${guest.name} network, last ${net.length * 2} seconds`}
          />
        </span>
        <span className="hidden text-neutral-70 text-sm tabular-nums sm:block">
          {guest.ips[0] ?? ""}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.dl
            key="detail"
            initial={still ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={still ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 gap-x-6 gap-y-1 overflow-hidden bg-neutral-10 px-6 text-sm sm:grid-cols-4 sm:pl-[4.5rem]"
          >
            <div className="col-span-full h-3" aria-hidden />
            <Fact
              k="CPU"
              v={running ? `${cpu.toFixed(1)}% of ${guest.cpus ?? "?"} cores` : "stopped"}
            />
            <Fact k="Memory" v={`${bytes(memUsed)} of ${bytes(memMax)}`} />
            <Fact k="Disk" v={`${bytes(guest.disk)} of ${bytes(guest.maxdisk)}`} />
            <Fact
              k="Network"
              v={`${bytes(liveGuest?.netin ?? guest.netin)} in, ${bytes(liveGuest?.netout ?? guest.netout)} out`}
            />
            {guest.ips.length > 0 ? <Fact k="Addresses" v={guest.ips.join(", ")} /> : null}
            <div className="col-span-full h-3" aria-hidden />
          </motion.dl>
        ) : null}
      </AnimatePresence>
    </motion.div>
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
