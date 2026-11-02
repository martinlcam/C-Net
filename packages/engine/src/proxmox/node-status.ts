import type { NodeMetrics } from "./types"

type RawNodeStatus = {
  cpu?: number
  /** Proxmox nests the core count here; there is no top-level `cpus` on node status. */
  cpuinfo?: { cpus?: number; model?: string }
  memory?: { used?: number; total?: number }
  rootfs?: { used?: number; total?: number }
  uptime?: number
  loadavg?: string[]
  wait?: number
}

/** `/nodes/{node}/status` → NodeMetrics. CPU comes back as a fraction; the UI wants percent. */
export function mapNodeStatus(node: string, data: RawNodeStatus): NodeMetrics {
  const memTotal = data.memory?.total ?? 0
  const memUsed = data.memory?.used ?? 0
  const diskTotal = data.rootfs?.total ?? 0
  const diskUsed = data.rootfs?.used ?? 0
  return {
    node,
    uptime: data.uptime,
    cpu: {
      usage: (data.cpu ?? 0) * 100,
      cores: data.cpuinfo?.cpus ?? 0,
    },
    memory: {
      used: memUsed,
      total: memTotal,
      percent: memTotal ? (memUsed / memTotal) * 100 : 0,
    },
    disk: {
      used: diskUsed,
      total: diskTotal,
      percent: diskTotal ? (diskUsed / diskTotal) * 100 : 0,
    },
  }
}
