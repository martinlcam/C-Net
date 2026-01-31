import axios, { type AxiosInstance } from 'axios'
import type { ProxmoxNode, ProxmoxVM, NodeMetrics, StoragePool } from '@/types/proxmox'

export class ProxmoxService {
  private client: AxiosInstance
  private baseURL: string

  constructor(host: string, user: string, token: string) {
    this.baseURL = `https://${host}:8006/api2/json`

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `PVEAPIToken=${user}!${token}`,
        'Content-Type': 'application/json',
      },
      httpsAgent: {
        rejectUnauthorized: false, // Use with caution; consider proper SSL
      },
    })
  }

  async getNodes(): Promise<ProxmoxNode[]> {
    try {
      const response = await this.client.get('/nodes')
      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to fetch Proxmox nodes: ${error instanceof Error ? error.message : 'Unknown error'}`
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
          percent: data.memory?.total
            ? ((data.memory.used || 0) / data.memory.total) * 100
            : 0,
        },
        disk: {
          used: data.rootfs?.used || 0,
          total: data.rootfs?.total || 0,
          percent: data.rootfs?.total
            ? ((data.rootfs.used || 0) / data.rootfs.total) * 100
            : 0,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch node status: ${error instanceof Error ? error.message : 'Unknown error'}`
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
              name: (vm.name as string) || '',
              status: (vm.status as string) === 'running' ? 'running' : 'stopped',
              node: node.node,
              cpu: Number(vm.cpus) || 0,
              maxmem: Number(vm.maxmem) || 0,
              mem: Number(vm.mem) || 0,
              uptime: Number(vm.uptime) || 0,
              type: 'qemu' as const,
            }))
          )

          // Get LXC containers
          const lxcResponse = await this.client.get(`/nodes/${node.node}/lxc?full=1`)
          const lxcs = lxcResponse.data.data || []

          allVMs.push(
            ...lxcs.map((lxc: Record<string, unknown>) => ({
              vmid: Number(lxc.vmid) || 0,
              name: (lxc.hostname as string) || '',
              status: (lxc.status as string) === 'running' ? 'running' : 'stopped',
              node: node.node,
              cpu: Number(lxc.cpus) || 0,
              maxmem: Number(lxc.maxmem) || 0,
              mem: Number(lxc.mem) || 0,
              uptime: Number(lxc.uptime) || 0,
              type: 'lxc' as const,
            }))
          )
        } catch (nodeError) {
          console.error(`Failed to fetch VMs from node ${node.node}:`, nodeError)
        }
      }

      return allVMs
    } catch (error) {
      throw new Error(
        `Failed to fetch all VMs: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu'
      const response = await this.client.post(
        `/nodes/${vm.node}/${endpoint}/${vmid}/status/start`
      )

      return response.data.data // Task ID
    } catch (error) {
      throw new Error(
        `Failed to start VM: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu'
      const response = await this.client.post(
        `/nodes/${vm.node}/${endpoint}/${vmid}/status/stop`
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to stop VM: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu'
      const response = await this.client.post(
        `/nodes/${vm.node}/${endpoint}/${vmid}/status/reboot`
      )

      return response.data.data
    } catch (error) {
      throw new Error(
        `Failed to restart VM: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getStorage(): Promise<StoragePool[]> {
    try {
      const response = await this.client.get('/storage')
      return response.data.data || []
    } catch (error) {
      throw new Error(
        `Failed to fetch storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
