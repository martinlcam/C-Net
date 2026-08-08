import https from "node:https"
import axios, { type AxiosInstance } from "axios"
import type { BayInventoryEntry } from "./bay-map"
import { assembleBays, mapPool, mapSmart } from "./storage"
import type {
  BayInfo,
  DiskSmart,
  PoolStatus,
  PveDisk,
  PveSmart,
  PveZfsListEntry,
  PveZfsTree,
} from "./storage-types"
import type {
  NodeMetrics,
  ProxmoxGuestAction,
  ProxmoxGuestType,
  ProxmoxNode,
  ProxmoxVM,
  ProxmoxVMStatus,
  StoragePool,
} from "./types"

const GUEST_STATUSES: ProxmoxVMStatus[] = ["running", "stopped", "paused", "suspended"]

/** PVE omits counters it has no value for; keep those `undefined` rather than collapsing to 0. */
function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function toStatus(value: unknown): ProxmoxVMStatus {
  const status = String(value ?? "")
  return GUEST_STATUSES.includes(status as ProxmoxVMStatus)
    ? (status as ProxmoxVMStatus)
    : "stopped"
}

function toTags(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value) return undefined
  const tags = value.split(/[;,]/).filter(Boolean)
  return tags.length > 0 ? tags : undefined
}

function mapGuest(raw: Record<string, unknown>, node: string, type: ProxmoxGuestType): ProxmoxVM {
  return {
    vmid: Number(raw.vmid) || 0,
    // Both guest endpoints report the display name as `name`; older PVE builds
    // only set `hostname` on containers, so fall back to it.
    name: (raw.name as string) || (raw.hostname as string) || "",
    status: toStatus(raw.status),
    node,
    type,
    cpu: num(raw.cpu),
    cpus: num(raw.cpus),
    mem: num(raw.mem),
    maxmem: num(raw.maxmem),
    disk: num(raw.disk),
    maxdisk: num(raw.maxdisk),
    diskread: num(raw.diskread),
    diskwrite: num(raw.diskwrite),
    netin: num(raw.netin),
    netout: num(raw.netout),
    uptime: num(raw.uptime),
    lock: (raw.lock as string) || undefined,
    template: raw.template === 1 || raw.template === true,
    tags: toTags(raw.tags),
  }
}

export class ProxmoxService {
  private readonly client: AxiosInstance
  private readonly baseURL: string

  constructor(host: string, user: string, token: string) {
    this.baseURL = `https://${host}:8006/api2/json`

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `PVEAPIToken=${user}!${token}`,
        "Content-Type": "application/json",
      },
      // PVE uses a self-signed cert by default; skip verification (LAN, token-auth).
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    })
  }

  async getNodes(): Promise<ProxmoxNode[]> {
    try {
      const response = await this.client.get("/nodes")
      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to fetch Proxmox nodes: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async getNodeStatus(node: string): Promise<NodeMetrics> {
    try {
      const response = await this.client.get(`/nodes/${node}/status`)
      const data = response.data.data

      return {
        node,
        uptime: data.uptime,
        cpu: {
          usage: (data.cpu || 0) * 100, // Convert to percentage
          cores: data.cpus || 0,
        },
        memory: {
          used: data.memory?.used || 0,
          total: data.memory?.total || 0,
          percent: data.memory?.total ? ((data.memory.used || 0) / data.memory.total) * 100 : 0,
        },
        disk: {
          used: data.rootfs?.used || 0,
          total: data.rootfs?.total || 0,
          percent: data.rootfs?.total ? ((data.rootfs.used || 0) / data.rootfs.total) * 100 : 0,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch node status: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /** One guest kind on one node. A failure is logged and yields nothing, never throws. */
  private async listGuests(
    node: string,
    type: ProxmoxGuestType,
    params?: Record<string, number>
  ): Promise<ProxmoxVM[]> {
    try {
      const response = await this.client.get(`/nodes/${node}/${type}`, { params })
      return (response.data.data || []).map((raw: Record<string, unknown>) =>
        mapGuest(raw, node, type)
      )
    } catch (error) {
      console.error(`Failed to fetch ${type} guests from node ${node}:`, error)
      return []
    }
  }

  /**
   * Both guest kinds on one node, fetched independently so a failure on one
   * doesn't hide the other. `full=1` is accepted by the qemu endpoint only —
   * the lxc schema rejects unknown properties outright with a 400.
   */
  private async getNodeGuests(node: string): Promise<ProxmoxVM[]> {
    const [qemu, lxc] = await Promise.all([
      this.listGuests(node, "qemu", { full: 1 }),
      this.listGuests(node, "lxc"),
    ])
    return [...qemu, ...lxc]
  }

  async getAllVMs(): Promise<ProxmoxVM[]> {
    try {
      const nodes = await this.getNodes()
      const perNode = await Promise.all(nodes.map((n) => this.getNodeGuests(n.node)))
      return perNode.flat().sort((a, b) => a.vmid - b.vmid)
    } catch (error) {
      throw new Error(
        `Failed to fetch all VMs: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async getVM(vmid: number): Promise<ProxmoxVM | undefined> {
    const vms = await this.getAllVMs()
    return vms.find((v) => v.vmid === vmid)
  }

  /**
   * Power action on a guest. The vmid alone doesn't say which node holds it or
   * whether it's a container, so resolve it first — PVE has no cluster-wide
   * status endpoint that would let us skip the lookup.
   */
  async guestAction(vmid: number, action: ProxmoxGuestAction): Promise<string> {
    try {
      const vm = await this.getVM(vmid)
      if (!vm) {
        throw new Error(`VM ${vmid} not found`)
      }
      if (vm.lock) {
        throw new Error(`VM ${vmid} is locked by PVE (${vm.lock}) — try again once it clears`)
      }

      const endpoint = vm.type === "lxc" ? "lxc" : "qemu"
      const response = await this.client.post(
        `/nodes/${vm.node}/${endpoint}/${vmid}/status/${action}`
      )

      return response.data.data // Task ID
    } catch (error) {
      throw new Error(
        `Failed to ${action} VM ${vmid}: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  startVM(vmid: number): Promise<string> {
    return this.guestAction(vmid, "start")
  }

  /** Hard power-off. Prefer `shutdownVM` — this is the pull-the-cord path. */
  stopVM(vmid: number): Promise<string> {
    return this.guestAction(vmid, "stop")
  }

  /** Graceful ACPI/init shutdown; the guest may refuse or take a while. */
  shutdownVM(vmid: number): Promise<string> {
    return this.guestAction(vmid, "shutdown")
  }

  restartVM(vmid: number): Promise<string> {
    return this.guestAction(vmid, "reboot")
  }

  async getStorage(): Promise<StoragePool[]> {
    try {
      const response = await this.client.get("/storage")
      return response.data.data || []
    } catch (error) {
      throw new Error(
        `Failed to fetch storage: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /* ---- ZFS / disk health (read-only storage GUI) ---- */

  /** Raw `disks/list` — physical drive identity + health. */
  async getDisks(node: string): Promise<PveDisk[]> {
    try {
      const response = await this.client.get(`/nodes/${node}/disks/list`)
      return response.data.data || []
    } catch (error) {
      throw new Error(
        `Failed to fetch disks: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /** Raw `disks/smart` for one device. Spins up standby drives — cache callers. */
  async getDiskSmart(node: string, devPath: string): Promise<PveSmart> {
    try {
      const response = await this.client.get(`/nodes/${node}/disks/smart`, {
        params: { disk: devPath },
      })
      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to fetch SMART for ${devPath}: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /** Raw `disks/zfs` — one entry per pool (capacity/health summary). */
  async listZfsPools(node: string): Promise<PveZfsListEntry[]> {
    try {
      const response = await this.client.get(`/nodes/${node}/disks/zfs`)
      return response.data.data || []
    } catch (error) {
      throw new Error(
        `Failed to list ZFS pools: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /** Raw `disks/zfs/{pool}` — full vdev tree incl. resilver/scrub scan state. */
  async getZfsPool(node: string, name: string): Promise<PveZfsTree> {
    try {
      const response = await this.client.get(`/nodes/${node}/disks/zfs/${name}`)
      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to fetch ZFS pool ${name}: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /** Composed: every pool's full status (capacity + vdev tree + resilver). */
  async getPoolStatuses(node: string): Promise<PoolStatus[]> {
    const list = await this.listZfsPools(node)
    const trees = await Promise.all(list.map((p) => this.getZfsPool(node, p.name)))
    return trees.map((tree, i) => mapPool(tree, list[i]))
  }

  /** Composed: the calibrated 12-bay view (occupancy, identity, pool membership). */
  async getBays(node: string, inventory: BayInventoryEntry[]): Promise<BayInfo[]> {
    const [disks, pools] = await Promise.all([this.getDisks(node), this.getPoolStatuses(node)])
    return assembleBays(disks, pools, inventory)
  }

  /** Composed: parsed SMART for one drive, located by serial via `disks/list`. */
  async getSmartBySerial(node: string, serial: string): Promise<DiskSmart> {
    const disks = await this.getDisks(node)
    const disk = disks.find((d) => d.serial === serial)
    if (!disk) {
      throw new Error(`No drive with serial ${serial} found on node ${node}`)
    }
    const raw = await this.getDiskSmart(node, disk.devpath)
    return mapSmart(serial, raw)
  }
}
