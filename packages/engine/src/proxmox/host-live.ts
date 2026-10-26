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
}

export interface HostLiveFrame {
  /** Discriminator so apps/realtime and the browser can route it like bd/bay frames. */
  t: "host"
  ts: number
  node: { cpu: number; mem: number; maxmem: number; uptimeSeconds: number }
  guests: HostLiveGuest[]
  ups: HostLiveUps | null
}
