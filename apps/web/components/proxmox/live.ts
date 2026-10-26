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
}

export type LiveFrame = {
  t: "host"
  ts: number
  node: { cpu: number; mem: number; maxmem: number; uptimeSeconds: number }
  guests: LiveGuest[]
  ups: LiveUps | null
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
