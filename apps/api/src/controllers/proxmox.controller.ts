import { decrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import {
  guestAddresses,
  logAuditAction,
  type PoolStatus,
  type ProxmoxGuestAction,
  ProxmoxService,
} from "@cnet/engine"
import { eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Controller, Get, Path, Post, Request, Response, Route, Security } from "tsoa"
import { getUpsSummary } from "../lib/ups-status"
import { HttpError } from "../middleware/error.middleware"

interface ProxmoxErrorResponse {
  error: string
  message?: string
}

interface GuestActionResponse {
  success: boolean
  taskId: string
}

/** A guest plus the addresses its running interfaces hold (empty when stopped). */
export type OverviewGuest = {
  vmid: number
  name: string
  status: string
  /** "lxc" or "qemu". */
  type: string
  /** CPU load as a fraction of one core (PVE convention), when running. */
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

export type OverviewStorage = {
  storage: string
  type: string
  active: boolean
  used: number | null
  total: number | null
  /** Set for ZFS storages whose pool is imported: health and raid level from zpool. */
  pool: { state: string; raid: string; scan: string; errors: string } | null
}

/**
 * Everything the dashboard's read-only environment panel shows, in one call.
 * Host-global (the proxbox node), so it uses the host token and is superuser-only.
 */
export type ProxmoxOverviewDTO = {
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

// The panel polls every 15 s and PVE answers a dozen calls per overview; one short
// cache keeps a second tab or a fast refresh from doubling the load on the host.
const OVERVIEW_TTL_MS = 10_000
let overviewCache: { at: number; value: ProxmoxOverviewDTO } | null = null
let overviewInFlight: Promise<ProxmoxOverviewDTO> | null = null

/**
 * Audit action name per power verb. `satisfies` keeps the values as literals so
 * they still narrow to the audit_action enum rather than widening to string.
 */
const AUDIT_ACTIONS = {
  start: "VM_STARTED",
  stop: "VM_STOPPED",
  shutdown: "VM_SHUTDOWN",
  reboot: "VM_RESTARTED",
} as const satisfies Record<ProxmoxGuestAction, string>

/*
 * Guest inventory + power control for the proxbox node. Superuser-gated for the
 * same reason as the storage GUI: these verbs act on host-global infrastructure,
 * and the fallback credentials below are the host's own API token.
 */
@Route("proxmox")
@Security("jwt", ["superuser"])
export class ProxmoxController extends Controller {
  /*
   * Per-user credentials win when a row exists; otherwise fall back to the
   * host-global CNET_STORAGE_PVE_* token the storage controller already uses.
   * infrastructure_configs has never been populated, so without the fallback
   * every guest request 404s.
   */
  private async getProxmoxService(
    userId: string
  ): Promise<{ proxmox: ProxmoxService } | { error: string }> {
    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })

    if (config) {
      const token = await decrypt(config.proxmoxToken, getEncryptionPassword())
      return { proxmox: new ProxmoxService(config.proxmoxHost, config.proxmoxUser, token) }
    }

    const host = process.env.CNET_STORAGE_PVE_HOST
    const user = process.env.CNET_STORAGE_PVE_USER
    const token = process.env.CNET_STORAGE_PVE_TOKEN

    if (!host || !user || !token) {
      return { error: "Proxmox configuration not found" }
    }

    return { proxmox: new ProxmoxService(host, user, token) }
  }

  /**
   * Run a power verb and audit it either way. Every outcome — including the
   * missing-config 404 — is recorded, so the audit log never silently skips an
   * attempt someone made against a guest.
   */
  private async runGuestAction(
    vmid: number,
    action: ProxmoxGuestAction,
    req: ExpressRequest
  ): Promise<GuestActionResponse | ProxmoxErrorResponse> {
    const user = req.user as { id: string }
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined
    const audit = {
      userId: user.id,
      action: AUDIT_ACTIONS[action],
      resourceType: "vm",
      resourceId: String(vmid),
      ipAddress,
    }

    try {
      const result = await this.getProxmoxService(user.id)

      if ("error" in result) {
        await logAuditAction({ ...audit, status: "failed", errorMessage: result.error })
        this.setStatus(404)
        return { error: result.error }
      }

      const taskId = await result.proxmox.guestAction(vmid, action)
      await logAuditAction({ ...audit, status: "success" })

      return { success: true, taskId }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await logAuditAction({ ...audit, status: "failed", errorMessage: message })

      console.error(`Failed to ${action} VM ${vmid}:`, error)
      this.setStatus(500)
      return { error: `Failed to ${action} VM`, message }
    }
  }

  /* GET /proxmox/overview — read-only snapshot of the proxbox environment. */
  @Get("overview")
  @Response<ProxmoxErrorResponse>(503, "Not configured")
  public async getOverview(): Promise<ProxmoxOverviewDTO> {
    const host = process.env.CNET_STORAGE_PVE_HOST
    const user = process.env.CNET_STORAGE_PVE_USER
    const token = process.env.CNET_STORAGE_PVE_TOKEN
    if (!host || !user || !token) {
      throw new HttpError(
        503,
        "Proxmox connection not configured: set CNET_STORAGE_PVE_HOST, CNET_STORAGE_PVE_USER and CNET_STORAGE_PVE_TOKEN"
      )
    }
    if (overviewCache && Date.now() - overviewCache.at < OVERVIEW_TTL_MS) return overviewCache.value
    if (!overviewInFlight) {
      overviewInFlight = buildOverview(new ProxmoxService(host, user, token)).finally(() => {
        overviewInFlight = null
      })
    }
    const value = await overviewInFlight
    overviewCache = { at: Date.now(), value }
    return value
  }

  /* GET /proxmox/nodes */
  @Get("nodes")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async getNodes(
    @Request() req: ExpressRequest
  ): Promise<{ data: unknown } | ProxmoxErrorResponse> {
    try {
      const user = req.user as { id: string }
      const result = await this.getProxmoxService(user.id)

      if ("error" in result) {
        this.setStatus(404)
        return { error: result.error }
      }

      const nodes = await result.proxmox.getNodes()
      return { data: nodes }
    } catch (error) {
      console.error("Failed to fetch Proxmox nodes:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch nodes",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* GET /proxmox/vms */
  @Get("vms")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async getVMs(
    @Request() req: ExpressRequest
  ): Promise<{ data: unknown } | ProxmoxErrorResponse> {
    try {
      const user = req.user as { id: string }
      const result = await this.getProxmoxService(user.id)

      if ("error" in result) {
        this.setStatus(404)
        return { error: result.error }
      }

      const vms = await result.proxmox.getAllVMs()
      return { data: vms }
    } catch (error) {
      console.error("Failed to fetch VMs:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch VMs",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* POST /proxmox/vms/{vmid}/start */
  @Post("vms/{vmid}/start")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async startVM(
    @Path() vmid: number,
    @Request() req: ExpressRequest
  ): Promise<GuestActionResponse | ProxmoxErrorResponse> {
    return this.runGuestAction(vmid, "start", req)
  }

  /* POST /proxmox/vms/{vmid}/stop — hard power-off */
  @Post("vms/{vmid}/stop")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async stopVM(
    @Path() vmid: number,
    @Request() req: ExpressRequest
  ): Promise<GuestActionResponse | ProxmoxErrorResponse> {
    return this.runGuestAction(vmid, "stop", req)
  }

  /* POST /proxmox/vms/{vmid}/shutdown — graceful, guest may refuse */
  @Post("vms/{vmid}/shutdown")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async shutdownVM(
    @Path() vmid: number,
    @Request() req: ExpressRequest
  ): Promise<GuestActionResponse | ProxmoxErrorResponse> {
    return this.runGuestAction(vmid, "shutdown", req)
  }

  /* POST /proxmox/vms/{vmid}/restart */
  @Post("vms/{vmid}/restart")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async restartVM(
    @Path() vmid: number,
    @Request() req: ExpressRequest
  ): Promise<GuestActionResponse | ProxmoxErrorResponse> {
    return this.runGuestAction(vmid, "reboot", req)
  }
}

async function buildOverview(proxmox: ProxmoxService): Promise<ProxmoxOverviewDTO> {
  const node = process.env.CNET_STORAGE_PVE_NODE || "proxbox"
  const [status, guests, storages, pools, ups] = await Promise.all([
    proxmox.getNodeStatus(node),
    proxmox.getAllVMs(),
    proxmox.getNodeStorages(node),
    proxmox.getPoolStatuses(node).catch((): PoolStatus[] => []),
    getUpsSummary(),
  ])
  const withIps: OverviewGuest[] = await Promise.all(
    guests.map(async (g): Promise<OverviewGuest> => {
      let ips: string[] = []
      if (g.type === "lxc" && g.status === "running") {
        ips = guestAddresses(await proxmox.getLxcInterfaces(node, g.vmid))
      }
      return {
        vmid: g.vmid,
        name: g.name ?? "",
        status: g.status,
        type: g.type ?? "qemu",
        cpu: g.cpu ?? null,
        cpus: g.cpus ?? null,
        mem: g.mem ?? null,
        maxmem: g.maxmem ?? null,
        disk: g.disk ?? null,
        maxdisk: g.maxdisk ?? null,
        netin: g.netin ?? null,
        netout: g.netout ?? null,
        uptimeSeconds: g.uptime ?? null,
        ips,
      }
    })
  )
  const poolByName = new Map(pools.map((p) => [p.name, p]))
  return {
    fetchedAt: new Date().toISOString(),
    node: {
      name: node,
      uptimeSeconds: status.uptime ?? null,
      cpuPercent: status.cpu.usage,
      cpuCores: status.cpu.cores,
      memoryUsed: status.memory.used,
      memoryTotal: status.memory.total,
      rootUsed: status.disk.used,
      rootTotal: status.disk.total,
    },
    guests: withIps.sort((a, b) => a.vmid - b.vmid),
    storages: storages
      .map((st) => {
        const pool = st.type === "zfspool" ? poolByName.get(st.storage) : undefined
        return {
          storage: st.storage,
          type: st.type,
          active: st.active === 1,
          used: st.used ?? null,
          total: st.total ?? null,
          pool: pool
            ? { state: pool.state, raid: pool.raid, scan: pool.scan.raw, errors: pool.errors }
            : null,
        }
      })
      .sort((a, b) => a.storage.localeCompare(b.storage)),
    ups,
  }
}
