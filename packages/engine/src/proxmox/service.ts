import axios, { type AxiosInstance } from "axios"
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
import type { NodeMetrics, ProxmoxNode, ProxmoxVM, StoragePool } from "./types"

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
      httpsAgent: {
        rejectUnauthorized: false, // Use with caution; consider proper SSL
      },
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

  async getAllVMs(): Promise<ProxmoxVM[]> {
    try {
      const nodes = await this.getNodes()
      const allVMs: ProxmoxVM[] = []

      for (const node of nodes) {
        try {
          // Get QEMU VMs
          const response = await this.client.get(`/nodes/${node.node}/qemu?full=1`)
          const vms = response.data.data || []

          allVMs.push(
            ...vms.map((vm: Record<string, unknown>) => ({
              vmid: Number(vm.vmid) || 0,
              name: (vm.name as string) || "",
              status: (vm.status as string) === "running" ? "running" : "stopped",
              node: node.node,
              cpu: Number(vm.cpus) || 0,
              maxmem: Number(vm.maxmem) || 0,
              mem: Number(vm.mem) || 0,
              uptime: Number(vm.uptime) || 0,
              type: "qemu" as const,
            }))
          )

          // Get LXC containers
          const lxcResponse = await this.client.get(`/nodes/${node.node}/lxc?full=1`)
          const lxcs = lxcResponse.data.data || []

          allVMs.push(
            ...lxcs.map((lxc: Record<string, unknown>) => ({
              vmid: Number(lxc.vmid) || 0,
              name: (lxc.hostname as string) || "",
              status: (lxc.status as string) === "running" ? "running" : "stopped",
              node: node.node,
              cpu: Number(lxc.cpus) || 0,
              maxmem: Number(lxc.maxmem) || 0,
              mem: Number(lxc.mem) || 0,
              uptime: Number(lxc.uptime) || 0,
              type: "lxc" as const,
            }))
          )
        } catch (nodeError) {
          console.error(`Failed to fetch VMs from node ${node.node}:`, nodeError)
        }
      }

      return allVMs
    } catch (error) {
      throw new Error(
        `Failed to fetch all VMs: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async startVM(vmid: number): Promise<string> {
    try {
      const vms = await this.getAllVMs()
      const vm = vms.find((v) => v.vmid === vmid)

      if (!vm) {
        throw new Error(`VM ${vmid} not found`)
      }

      const endpoint = vm.type === "lxc" ? "lxc" : "qemu"
      const response = await this.client.post(`/nodes/${vm.node}/${endpoint}/${vmid}/status/start`)

      return response.data.data // Task ID
    } catch (error) {
      throw new Error(
        `Failed to start VM: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async stopVM(vmid: number): Promise<string> {
    try {
      const vms = await this.getAllVMs()
      const vm = vms.find((v) => v.vmid === vmid)

      if (!vm) {
        throw new Error(`VM ${vmid} not found`)
      }

      const endpoint = vm.type === "lxc" ? "lxc" : "qemu"
      const response = await this.client.post(`/nodes/${vm.node}/${endpoint}/${vmid}/status/stop`)

      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to stop VM: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  async restartVM(vmid: number): Promise<string> {
    try {
      const vms = await this.getAllVMs()
      const vm = vms.find((v) => v.vmid === vmid)

      if (!vm) {
        throw new Error(`VM ${vmid} not found`)
      }

      const endpoint = vm.type === "lxc" ? "lxc" : "qemu"
      const response = await this.client.post(`/nodes/${vm.node}/${endpoint}/${vmid}/status/reboot`)

      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to restart VM: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
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
  async getBays(node: string): Promise<BayInfo[]> {
    const [disks, pools] = await Promise.all([this.getDisks(node), this.getPoolStatuses(node)])
    return assembleBays(disks, pools)
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
