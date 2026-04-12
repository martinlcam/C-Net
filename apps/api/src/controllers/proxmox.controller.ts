import { decrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import { logAuditAction, ProxmoxService } from "@cnet/engine"
import { eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Controller, Get, Path, Post, Request, Response, Route, Security } from "tsoa"

interface ProxmoxErrorResponse {
  error: string
  message?: string
}

@Route("proxmox")
@Security("jwt")
export class ProxmoxController extends Controller {
  /* Helper: get a ProxmoxService instance for the authenticated user */
  private async getProxmoxService(
    userId: string
  ): Promise<{ proxmox: ProxmoxService } | { error: string }> {
    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })

    if (!config) {
      return { error: "Proxmox configuration not found" }
    }

    const password = getEncryptionPassword()
    const token = await decrypt(config.proxmoxToken, password)

    return { proxmox: new ProxmoxService(config.proxmoxHost, config.proxmoxUser, token) }
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
  ): Promise<{ success: boolean; taskId: string } | ProxmoxErrorResponse> {
    const user = req.user as { id: string }
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined

    try {
      const result = await this.getProxmoxService(user.id)

      if ("error" in result) {
        this.setStatus(404)
        return { error: result.error }
      }

      const taskId = await result.proxmox.startVM(vmid)

      await logAuditAction({
        userId: user.id,
        action: "VM_STARTED",
        resourceType: "vm",
        resourceId: String(vmid),
        status: "success",
        ipAddress: ipAddress,
      })

      return { success: true, taskId }
    } catch (error) {
      await logAuditAction({
        userId: user.id,
        action: "VM_STARTED",
        resourceType: "vm",
        resourceId: String(vmid),
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        ipAddress: ipAddress,
      })

      console.error("Failed to start VM:", error)
      this.setStatus(500)
      return {
        error: "Failed to start VM",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* POST /proxmox/vms/{vmid}/stop */
  @Post("vms/{vmid}/stop")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async stopVM(
    @Path() vmid: number,
    @Request() req: ExpressRequest
  ): Promise<{ success: boolean; taskId: string } | ProxmoxErrorResponse> {
    const user = req.user as { id: string }
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined

    try {
      const result = await this.getProxmoxService(user.id)

      if ("error" in result) {
        this.setStatus(404)
        return { error: result.error }
      }

      const taskId = await result.proxmox.stopVM(vmid)

      await logAuditAction({
        userId: user.id,
        action: "VM_STOPPED",
        resourceType: "vm",
        resourceId: String(vmid),
        status: "success",
        ipAddress: ipAddress,
      })

      return { success: true, taskId }
    } catch (error) {
      await logAuditAction({
        userId: user.id,
        action: "VM_STOPPED",
        resourceType: "vm",
        resourceId: String(vmid),
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        ipAddress: ipAddress,
      })

      console.error("Failed to stop VM:", error)
      this.setStatus(500)
      return {
        error: "Failed to stop VM",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* POST /proxmox/vms/{vmid}/restart */
  @Post("vms/{vmid}/restart")
  @Response<ProxmoxErrorResponse>(404, "Config not found")
  @Response<ProxmoxErrorResponse>(500, "Server error")
  public async restartVM(
    @Path() vmid: number,
    @Request() req: ExpressRequest
  ): Promise<{ success: boolean; taskId: string } | ProxmoxErrorResponse> {
    const user = req.user as { id: string }
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined

    try {
      const result = await this.getProxmoxService(user.id)

      if ("error" in result) {
        this.setStatus(404)
        return { error: result.error }
      }

      const taskId = await result.proxmox.restartVM(vmid)

      await logAuditAction({
        userId: user.id,
        action: "VM_RESTARTED",
        resourceType: "vm",
        resourceId: String(vmid),
        status: "success",
        ipAddress: ipAddress,
      })

      return { success: true, taskId }
    } catch (error) {
      await logAuditAction({
        userId: user.id,
        action: "VM_RESTARTED",
        resourceType: "vm",
        resourceId: String(vmid),
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        ipAddress: ipAddress,
      })

      console.error("Failed to restart VM:", error)
      this.setStatus(500)
      return {
        error: "Failed to restart VM",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
