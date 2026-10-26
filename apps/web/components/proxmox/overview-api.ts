/** Client for GET /proxmox/overview; shapes mirror ProxmoxOverviewDTO on the API side. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export type OverviewGuest = {
  vmid: number
  name: string
  status: string
  type: string
  cpu: number | null
  cpus: number | null
  mem: number | null
  maxmem: number | null
  disk: number | null
  maxdisk: number | null
  netin: number | null
  netout: number | null
  uptimeSeconds: number | null
  ips: string[]
}

export type OverviewStorage = {
  storage: string
  type: string
  active: boolean
  used: number | null
  total: number | null
  pool: { state: string; raid: string; scan: string; errors: string } | null
}

export type OverviewUps = {
  ts: number
  model: string | null
  status: string[]
  onBattery: boolean
  lowBattery: boolean
  chargePercent: number | null
  runtimeSeconds: number | null
  loadPercent: number | null
  loadWatts: number | null
  inputVoltage: number | null
  outputVoltage: number | null
}

export type ProxmoxOverview = {
  fetchedAt: string
  node: {
    name: string
    uptimeSeconds: number | null
    cpuPercent: number
    cpuCores: number
    memoryUsed: number
    memoryTotal: number
    rootUsed: number
    rootTotal: number
  }
  guests: OverviewGuest[]
  storages: OverviewStorage[]
  ups: OverviewUps | null
}

export class OverviewError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "OverviewError"
  }
}

export async function fetchOverview(): Promise<ProxmoxOverview> {
  const res = await fetch(`${API_BASE}/proxmox/overview`, { credentials: "include" })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new OverviewError(res.status, body.message || `Request failed (${res.status})`)
  }
  return res.json() as Promise<ProxmoxOverview>
}
