import { decrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import { logAuditAction, type ProxmoxGuestAction, ProxmoxService } from "@cnet/engine"
import { eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Controller, Get, Path, Post, Request, Response, Route, Security } from "tsoa"

interface ProxmoxErrorResponse {
  error: string
  message?: string
}

interface GuestActionResponse {
  success: boolean
  taskId: string
}

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
