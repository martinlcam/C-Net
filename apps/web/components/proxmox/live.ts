/*
 * Pure helpers over host live frames (see packages/engine host-live.ts): the diff that
 * feeds the event strip, the ring buffer the sparklines read, network rates from
 * cumulative counters, and the battery and dial models. No React, no I/O.
 */

export type LiveUps = {
  status: string[]
  onBattery: boolean
  lowBattery: boolean
  chargePercent: number | null
  runtimeSeconds: number | null
  loadPercent: number | null
  loadWatts: number | null
  nominalWatts: number | null
  inputVoltage: number | null
}

export type LiveGuest = {
  vmid: number
  name: string
  type: string
  status: string
  cpu: number
  mem: number
  maxmem: number
  netin: number
  netout: number
  uptimeSeconds: number
  cpus?: number
  disk?: number
  maxdisk?: number
  diskread?: number
  diskwrite?: number
}

export type LiveNode = {
  cpu: number
  mem: number
  maxmem: number
  uptimeSeconds: number
  cores?: number
  iowait?: number
  loadavg?: number[]
  swap?: number
  maxswap?: number
  netin?: number
  netout?: number
  cpuMhz?: number
  /** PSI "some" 10 s averages, percent of time something waited on cpu, io, memory. */
  psi?: { cpu: number; io: number; mem: number }
}

export type LiveTemp = { label: string; c: number }
export type LiveFan = { label: string; rpm: number | null; percent: number | null }
export type LiveZfs = {
  pool: string
  reads: number
  writes: number
  nread: number
  nwritten: number
}

export type LiveFrame = {
  t: "host"
  ts: number
  node: LiveNode
  guests: LiveGuest[]
  ups: LiveUps | null
  sensors?: { temps: LiveTemp[]; fans: LiveFan[] }
  zfs?: LiveZfs[]
}

export type GuestEvent =
  | { ts: number; vmid: number; name: string; kind: "status"; from: string; to: string }
  | { ts: number; vmid: number; name: string; kind: "appeared" }
  | { ts: number; vmid: number; name: string; kind: "gone" }

/** What changed between two frames, in vmid order; empty when nothing did. */
export function diffGuestEvents(prev: LiveFrame, next: LiveFrame): GuestEvent[] {
  const before = new Map(prev.guests.map((g) => [g.vmid, g]))
  const after = new Map(next.guests.map((g) => [g.vmid, g]))
  const events: GuestEvent[] = []
  const vmids = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b)
  for (const vmid of vmids) {
    const a = before.get(vmid)
    const b = after.get(vmid)
    if (a && b) {
      if (a.status !== b.status) {
        events.push({
          ts: next.ts,
          vmid,
          name: b.name,
          kind: "status",
          from: a.status,
          to: b.status,
        })
      }
    } else if (a) {
      events.push({ ts: next.ts, vmid, name: a.name, kind: "gone" })
    } else if (b) {
      events.push({ ts: next.ts, vmid, name: b.name, kind: "appeared" })
    }
  }
  return events
}

/** Append a frame to a chronological buffer, dropping the oldest beyond `max`. */
export function appendFrame(buffer: LiveFrame[], frame: LiveFrame, max: number): LiveFrame[] {
  const newest = buffer[buffer.length - 1]
  if (newest && frame.ts <= newest.ts) return buffer
  const next = [...buffer, frame]
  return next.length > max ? next.slice(next.length - max) : next
}

/** Bytes per second for one guest between two frames; a counter reset reads as zero. */
export function netRate(
  prev: LiveFrame,
  next: LiveFrame,
  vmid: number
): { inBps: number; outBps: number } {
  const a = prev.guests.find((g) => g.vmid === vmid)
  const b = next.guests.find((g) => g.vmid === vmid)
  const dt = (next.ts - prev.ts) / 1000
  if (!a || !b || dt <= 0) return { inBps: 0, outBps: 0 }
  return {
    inBps: Math.max(0, (b.netin - a.netin) / dt),
    outBps: Math.max(0, (b.netout - a.netout) / dt),
  }
}

/** Bytes per second between two cumulative counters; a reset or missing counter reads as zero. */
function perSecond(prev: number | undefined, next: number | undefined, dtSeconds: number): number {
  if (prev === undefined || next === undefined || dtSeconds <= 0) return 0
  return Math.max(0, (next - prev) / dtSeconds)
}

/** Disk read and write rates for one guest between two frames. */
export function diskRate(
  prev: LiveFrame,
  next: LiveFrame,
  vmid: number
): { readBps: number; writeBps: number } {
  const a = prev.guests.find((g) => g.vmid === vmid)
  const b = next.guests.find((g) => g.vmid === vmid)
  const dt = (next.ts - prev.ts) / 1000
  if (!a || !b) return { readBps: 0, writeBps: 0 }
  return {
    readBps: perSecond(a.diskread, b.diskread, dt),
    writeBps: perSecond(a.diskwrite, b.diskwrite, dt),
  }
}

/** The host uplink's rates between two frames, from the node's cumulative counters. */
export function nodeNetRate(prev: LiveFrame, next: LiveFrame): { inBps: number; outBps: number } {
  const dt = (next.ts - prev.ts) / 1000
  return {
    inBps: perSecond(prev.node.netin, next.node.netin, dt),
    outBps: perSecond(prev.node.netout, next.node.netout, dt),
  }
}

/** Read and write rates for one ZFS pool between two frames. */
export function zfsRate(
  prev: LiveFrame,
  next: LiveFrame,
  pool: string
): { readBps: number; writeBps: number } {
  const a = prev.zfs?.find((z) => z.pool === pool)
  const b = next.zfs?.find((z) => z.pool === pool)
  const dt = (next.ts - prev.ts) / 1000
  return {
    readBps: perSecond(a?.nread, b?.nread, dt),
    writeBps: perSecond(a?.nwritten, b?.nwritten, dt),
  }
}

/** One value per interval of a chronological buffer: n frames give n-1 points. */
export function rateSeries<T>(
  frames: LiveFrame[],
  rate: (prev: LiveFrame, next: LiveFrame) => T
): T[] {
  const out: T[] = []
  for (let i = 1; i < frames.length; i++) out.push(rate(frames[i - 1], frames[i]))
  return out
}

/** One entry of the activity feed, whichever source it came from. */
export type ActivityItem = {
  key: string
  ts: number
  text: string
  state: "ok" | "failed" | "running" | "info"
}

export type TaskLike = {
  upid: string
  type: string
  id: string | null
  startedAt: number
  endedAt: number | null
  running: boolean
  ok: boolean | null
}

const TASK_VERBS: Record<string, { past: string; now: string }> = {
  vzstart: { past: "started", now: "starting" },
  qmstart: { past: "started", now: "starting" },
  vzstop: { past: "stopped", now: "stopping" },
  qmstop: { past: "stopped", now: "stopping" },
  vzshutdown: { past: "shut down", now: "shutting down" },
  qmshutdown: { past: "shut down", now: "shutting down" },
  vzreboot: { past: "rebooted", now: "rebooting" },
  qmreboot: { past: "rebooted", now: "rebooting" },
  vzdump: { past: "backed up", now: "backing up" },
  vzcreate: { past: "created", now: "creating" },
  qmcreate: { past: "created", now: "creating" },
  vzdestroy: { past: "destroyed", now: "destroying" },
  qmdestroy: { past: "destroyed", now: "destroying" },
  vzsnapshot: { past: "snapshotted", now: "snapshotting" },
  qmsnapshot: { past: "snapshotted", now: "snapshotting" },
  vzmigrate: { past: "migrated", now: "migrating" },
  qmigrate: { past: "migrated", now: "migrating" },
  vzrestore: { past: "restored", now: "restoring" },
  qmrestore: { past: "restored", now: "restoring" },
  vzclone: { past: "cloned", now: "cloning" },
  qmclone: { past: "cloned", now: "cloning" },
  push_file: { past: "received a file", now: "receiving a file" },
  pull_file: { past: "sent a file", now: "sending a file" },
  vncproxy: { past: "console opened", now: "console open" },
  vncshell: { past: "shell opened", now: "shell open" },
  spiceproxy: { past: "console opened", now: "console open" },
}

const NODE_TASKS: Record<string, { past: string; now: string }> = {
  aptupdate: { past: "package lists refreshed", now: "refreshing package lists" },
  startall: { past: "all guests started", now: "starting all guests" },
  stopall: { past: "all guests stopped", now: "stopping all guests" },
  srvstart: { past: "service started", now: "starting a service" },
  srvstop: { past: "service stopped", now: "stopping a service" },
  srvrestart: { past: "service restarted", now: "restarting a service" },
  download: { past: "download finished", now: "downloading" },
  imgcopy: { past: "image copied", now: "copying an image" },
}

/** A Proxmox task as one plain phrase: "jellyfin backed up", "backing up jellyfin", "arr start failed". */
export function describeTask(task: TaskLike, names: Map<number, string>): string {
  const subject = task.id ? (names.get(Number(task.id)) ?? task.id) : null
  const guestVerb = TASK_VERBS[task.type]
  if (guestVerb && subject) {
    if (task.running) return `${guestVerb.now} ${subject}`
    if (task.ok === false) return `${subject} ${guestVerb.past.split(" ")[0]} failed`
    return `${subject} ${guestVerb.past}`
  }
  const nodeVerb = NODE_TASKS[task.type]
  if (nodeVerb) {
    if (task.running) return nodeVerb.now
    return task.ok === false ? `${nodeVerb.past}, failed` : nodeVerb.past
  }
  const raw = subject ? `${task.type} ${subject}` : task.type
  if (task.running) return `${raw} running`
  return task.ok === false ? `${raw} failed` : raw
}

/**
 * Live guest events and the node's task log as one feed, newest first. Tasks that are
 * running sort to the top; a live event and the task that caused it both appear, which
 * is honest about what was seen.
 */
export function mergeActivity(
  events: GuestEvent[],
  tasks: TaskLike[],
  names: Map<number, string>,
  max = 8
): ActivityItem[] {
  const fromEvents: ActivityItem[] = events.map((e) => ({
    key: `event-${e.vmid}-${e.ts}-${e.kind}`,
    ts: e.ts,
    text: describeEvent(e),
    state: e.kind === "status" && e.to !== "running" ? "info" : "ok",
  }))
  const fromTasks: ActivityItem[] = tasks.map((t) => ({
    key: `task-${t.upid}`,
    ts: t.endedAt ?? t.startedAt,
    text: describeTask(t, names),
    state: t.running ? "running" : t.ok === false ? "failed" : "ok",
  }))
  return [...fromEvents, ...fromTasks]
    .sort((a, b) => Number(b.state === "running") - Number(a.state === "running") || b.ts - a.ts)
    .slice(0, max)
}

function describeEvent(e: GuestEvent): string {
  const who = e.name || String(e.vmid)
  switch (e.kind) {
    case "status":
      return `${who} ${e.to === "running" ? "came up" : e.to}`
    case "appeared":
      return `${who} appeared`
    case "gone":
      return `${who} disappeared`
  }
}

export type BatteryMode = "full" | "charging" | "draining" | "critical" | "unknown"

export type BatteryModel = {
  fill: number
  mode: BatteryMode
  /** Percent of charge lost per minute while draining, from recent frames; null if unknown. */
  drainPercentPerMinute: number | null
}

export function batteryModel(ups: LiveUps | null, history: LiveFrame[]): BatteryModel {
  if (!ups || ups.chargePercent === null) {
    return { fill: ups?.chargePercent ?? 0, mode: "unknown", drainPercentPerMinute: null }
  }
  const fill = Math.max(0, Math.min(100, ups.chargePercent))
  if (ups.onBattery) {
    const first = history.find((f) => f.ups?.onBattery && f.ups.chargePercent !== null)
    const last = [...history]
      .reverse()
      .find((f) => f.ups?.onBattery && f.ups.chargePercent !== null)
    let drain: number | null = null
    if (first && last && last.ts > first.ts && first.ups && last.ups) {
      const minutes = (last.ts - first.ts) / 60_000
      drain = ((first.ups.chargePercent ?? 0) - (last.ups.chargePercent ?? 0)) / minutes
    }
    return { fill, mode: ups.lowBattery ? "critical" : "draining", drainPercentPerMinute: drain }
  }
  return { fill, mode: fill >= 100 ? "full" : "charging", drainPercentPerMinute: null }
}

/** Needle angle in degrees for a 240° dial: -120 at zero, +120 at the nominal rating. */
export function dialAngle(watts: number | null, nominal: number): number {
  if (watts === null || nominal <= 0) return -120
  const fraction = Math.max(0, Math.min(1, watts / nominal))
  return -120 + fraction * 240
}

/** The newest frame's value for `pick`, falling back through older frames that have one. */
export function newestWith<T>(
  frames: LiveFrame[],
  pick: (f: LiveFrame) => T | undefined
): T | undefined {
  for (let i = frames.length - 1; i >= 0; i--) {
    const v = pick(frames[i])
    if (v !== undefined) return v
  }
  return undefined
}
