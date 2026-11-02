/*
 * What the node has been doing: its recent tasks (backups, starts, file pushes), the state of
 * the pve daemons, and the RRD history Proxmox keeps at one-minute resolution. Pure mappers
 * over the API's shapes; ProxmoxService does the fetching.
 */

export type PveTaskRaw = {
  upid: string
  type: string
  id?: string
  user: string
  node: string
  status?: string
  starttime: number
  endtime?: number
}

export type NodeTask = {
  upid: string
  type: string
  /** The vmid or storage the task acted on, when it had one. */
  id: string | null
  user: string
  startedAt: number
  endedAt: number | null
  running: boolean
  /** True when it finished OK, false when it ended with an error, null while running. */
  ok: boolean | null
  /** The error text PVE kept, for tasks that failed. */
  status: string | null
}

export function mapNodeTask(raw: PveTaskRaw): NodeTask {
  const running = raw.endtime === undefined || raw.endtime === null
  const status = raw.status ?? null
  return {
    upid: raw.upid,
    type: raw.type,
    id: raw.id ? String(raw.id) : null,
    user: raw.user,
    startedAt: raw.starttime * 1000,
    endedAt: running ? null : (raw.endtime as number) * 1000,
    running,
    ok: running ? null : status === "OK",
    status,
  }
}

export type PveServiceRaw = {
  name: string
  desc?: string
  state: string
  "active-state"?: string
  "unit-state"?: string
}

export type NodeService = {
  name: string
  description: string
  state: string
  running: boolean
  /** Enabled at boot; a stopped-but-enabled service is the one worth a second look. */
  enabled: boolean
}

export function mapNodeService(raw: PveServiceRaw): NodeService {
  return {
    name: raw.name,
    description: raw.desc ?? "",
    state: raw.state,
    running: raw["active-state"] === "active" || raw.state === "running",
    enabled: raw["unit-state"] === "enabled",
  }
}

export type RrdTimeframe = "hour" | "day"

export type PveRrdRaw = Record<string, number | string | null | undefined>

export type RrdPoint = {
  time: number
  /** Busy fraction of all cores (0..1). */
  cpu: number
  iowait: number
  loadavg: number
  memused: number
  memtotal: number
  swapused: number
  /** Bytes per second averaged over the slot. */
  netin: number
  netout: number
  arcsize: number
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

/** Null for the empty slots RRD pads the future with. */
export function mapRrdPoint(raw: PveRrdRaw): RrdPoint | null {
  const time = n(raw.time)
  const cpu = n(raw.cpu)
  if (time === null || cpu === null) return null
  return {
    time: time * 1000,
    cpu,
    iowait: n(raw.iowait) ?? 0,
    loadavg: n(raw.loadavg) ?? 0,
    memused: n(raw.memused) ?? 0,
    memtotal: n(raw.memtotal) ?? 0,
    swapused: n(raw.swapused) ?? 0,
    netin: n(raw.netin) ?? 0,
    netout: n(raw.netout) ?? 0,
    arcsize: n(raw.arcsize) ?? 0,
  }
}
