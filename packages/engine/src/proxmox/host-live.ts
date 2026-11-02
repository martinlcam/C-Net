/*
 * Live host telemetry streamed by the host agent (deploy/host/host-publish.ts) over
 * Redis → apps/realtime WS → browser, the same way bay frames travel. Identity and
 * storage stay on the REST overview; this is only what moves second to second.
 */

/** Redis pub/sub channel the host agent publishes HostLiveFrame JSON on. */
export const HOST_STATUS_CHANNEL = "host:status"
/** Redis list holding the most recent frames (newest first) for replay on page load. */
export const HOST_HISTORY_KEY = "host:history"
/** Frames kept in the history list: 90 at a 2 s cadence is three minutes. */
export const HOST_HISTORY_LEN = 90

export interface HostLiveUps {
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

export interface HostLiveGuest {
  vmid: number
  name: string
  type: "lxc" | "qemu"
  status: string
  /** Fraction of one core, PVE convention. */
  cpu: number
  mem: number
  maxmem: number
  /** Cumulative byte counters; the UI differences consecutive frames for a rate. */
  netin: number
  netout: number
  uptimeSeconds: number
  cpus?: number
  disk?: number
  maxdisk?: number
  diskread?: number
  diskwrite?: number
}

export interface HostLiveNode {
  /** Busy fraction of all cores (0..1). */
  cpu: number
  mem: number
  maxmem: number
  uptimeSeconds: number
  // Present on frames from agents newer than 2026-11-02; older history frames lack them.
  cores?: number
  iowait?: number
  loadavg?: number[]
  swap?: number
  maxswap?: number
  /** Cumulative bytes on the host uplink; the UI differences frames for a rate. */
  netin?: number
  netout?: number
  /** Mean core clock right now. */
  cpuMhz?: number
  /** PSI "some" 10 s averages: share of time something was stalled on cpu, io, memory (0..100). */
  psi?: { cpu: number; io: number; mem: number }
}

export interface HostLiveTemp {
  label: string
  c: number
}

/** A fan with whichever of tachometer (rpm) and duty (percent) the driver exposes. */
export interface HostLiveFan {
  label: string
  rpm: number | null
  percent: number | null
}

/** Cumulative IO of one imported pool; the UI differences frames for a rate. */
export interface HostLiveZfs {
  pool: string
  reads: number
  writes: number
  nread: number
  nwritten: number
}

export interface HostLiveFrame {
  /** Discriminator so apps/realtime and the browser can route it like bd/bay frames. */
  t: "host"
  ts: number
  node: HostLiveNode
  guests: HostLiveGuest[]
  ups: HostLiveUps | null
  // Present on frames from agents newer than 2026-11-02.
  sensors?: { temps: HostLiveTemp[]; fans: HostLiveFan[] }
  zfs?: HostLiveZfs[]
}
