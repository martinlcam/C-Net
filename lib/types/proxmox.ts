export interface ProxmoxNode {
  node: string
  status: string
  cpu?: number
  level?: string
  maxcpu?: number
  maxmem?: number
  mem?: number
  ssl_fingerprint?: string
  uptime?: number
}

export interface ProxmoxVM {
  vmid: number
  name?: string
  status: "running" | "stopped" | "paused"
  node: string
  cpu?: number
  maxmem?: number
  mem?: number
  uptime?: number
  type?: "qemu" | "lxc"
}

export interface NodeMetrics {
  node: string
  uptime?: number
  cpu: {
    usage: number // percentage
    cores: number
  }
  memory: {
    used: number
    total: number
    percent: number
  }
  disk: {
    used: number
    total: number
    percent: number
  }
}

export interface StoragePool {
  storage: string
  type: string
  content?: string
  nodes?: string
  shared?: boolean
}
