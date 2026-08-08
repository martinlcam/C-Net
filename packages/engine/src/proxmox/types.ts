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

export type ProxmoxGuestType = "qemu" | "lxc"

export type ProxmoxVMStatus = "running" | "stopped" | "paused" | "suspended"

/** Power verbs PVE accepts under `/status`, for both `qemu` and `lxc` guests. */
export type ProxmoxGuestAction = "start" | "stop" | "shutdown" | "reboot"

/**
 * A guest from `/nodes/{node}/qemu` or `/nodes/{node}/lxc`. Field names mirror
 * PVE's own so the mapping stays checkable against the API docs — note `cpu` is
 * the usage fraction (0–1) and `cpus` the allocated core count.
 */
export interface ProxmoxVM {
  vmid: number
  name?: string
  status: ProxmoxVMStatus
  node: string
  type?: ProxmoxGuestType
  cpu?: number
  cpus?: number
  mem?: number
  maxmem?: number
  disk?: number
  maxdisk?: number
  diskread?: number
  diskwrite?: number
  netin?: number
  netout?: number
  uptime?: number
  /** Present while PVE holds a lock (backup, migrate, snapshot); actions are refused until it clears. */
  lock?: string
  template?: boolean
  tags?: string[]
}

export interface NodeMetrics {
  node: string
  uptime?: number
  cpu: {
    usage: number
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
