import { createHash, timingSafeEqual } from "node:crypto"
import { logAuditAction, ProxmoxService } from "@cnet/engine"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Path, Post, Request, Response, Route, Security, Tags } from "tsoa"
import { BayCommandError, sendBayCommand } from "../lib/bay-command-client"

interface StorageErrorResponse {
  error: string
  message?: string
}

interface LocateBody {
  serial: string
  on: boolean
}
interface SpindownBody {
  serial: string
}
interface ZpoolBody {
  action: "replace" | "offline" | "online" | "scrub"
  pool: string
  target?: string
  newTarget?: string
  /** Required for destructive actions (replace/offline). */
  password?: string
}
interface ActionResult {
  ok: boolean
  output?: string
}

const DESTRUCTIVE = new Set(["replace", "offline"])

type AuditAction = Parameters<typeof logAuditAction>[0]["action"]

const ZPOOL_AUDIT: Record<ZpoolBody["action"], AuditAction> = {
  replace: "STORAGE_ZPOOL_REPLACE",
  offline: "STORAGE_ZPOOL_OFFLINE",
  online: "STORAGE_ZPOOL_ONLINE",
  scrub: "STORAGE_ZPOOL_SCRUB",
}

/*
 * Host-global ZFS / 12-bay storage view + actions for the proxbox node.
 * Read paths use the Proxmox REST API; live telemetry + action verbs go through
 * the cnet-bayd host agent over Redis (HMAC-signed). Gated to the allowlisted
 * superuser; destructive zpool ops additionally require the op password. See
 * docs/ZFS_BAY_GUI_PLAN.md.
 */
@Route("proxmox/storage")
@Tags("Storage")
@Security("jwt", ["superuser"])
export class StorageController extends Controller {
  private static getService(): ProxmoxService | null {
    const host = process.env.CNET_STORAGE_PVE_HOST
    const user = process.env.CNET_STORAGE_PVE_USER
    const token = process.env.CNET_STORAGE_PVE_TOKEN
    if (!host || !user || !token) return null
    return new ProxmoxService(host, user, token)
  }

  private static get node(): string {
    return process.env.CNET_STORAGE_PVE_NODE || "proxbox"
  }

  private notConfigured(): StorageErrorResponse {
    this.setStatus(503)
    return {
      error: "Storage Proxmox connection not configured",
      message: "Set CNET_STORAGE_PVE_HOST, CNET_STORAGE_PVE_USER and CNET_STORAGE_PVE_TOKEN.",
    }
  }

  /** Verify the op password against CNET_STORAGE_OP_PASSWORD_HASH (sha256 hex). */
  private static checkOpPassword(provided: string | undefined): boolean {
    const hash = process.env.CNET_STORAGE_OP_PASSWORD_HASH
    if (!hash || !provided) return false
    const given = createHash("sha256").update(provided).digest("hex")
    const a = Buffer.from(given, "hex")
    const b = Buffer.from(hash, "hex")
    return a.length === b.length && timingSafeEqual(a, b)
  }

  /* GET /proxmox/storage/bays */
  @Get("bays")
  @Response<StorageErrorResponse>(503, "Not configured")
  @Response<StorageErrorResponse>(500, "Server error")
  public async getBays(): Promise<{ data: unknown } | StorageErrorResponse> {
    const proxmox = StorageController.getService()
    if (!proxmox) return this.notConfigured()
    try {
      return { data: await proxmox.getBays(StorageController.node) }
    } catch (error) {
      console.error("Failed to fetch bays:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch bays",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* GET /proxmox/storage/pools */
  @Get("pools")
  @Response<StorageErrorResponse>(503, "Not configured")
  @Response<StorageErrorResponse>(500, "Server error")
  public async getPools(): Promise<{ data: unknown } | StorageErrorResponse> {
    const proxmox = StorageController.getService()
    if (!proxmox) return this.notConfigured()
    try {
      return { data: await proxmox.getPoolStatuses(StorageController.node) }
    } catch (error) {
      console.error("Failed to fetch pools:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch pools",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* GET /proxmox/storage/disks/{serial}/smart */
  @Get("disks/{serial}/smart")
  @Response<StorageErrorResponse>(503, "Not configured")
  @Response<StorageErrorResponse>(404, "Drive not found")
  @Response<StorageErrorResponse>(500, "Server error")
  public async getSmart(@Path() serial: string): Promise<{ data: unknown } | StorageErrorResponse> {
    const proxmox = StorageController.getService()
    if (!proxmox) return this.notConfigured()
    try {
      return { data: await proxmox.getSmartBySerial(StorageController.node, serial) }
    } catch (error) {
      console.error(`Failed to fetch SMART for ${serial}:`, error)
      this.setStatus(error instanceof Error && error.message.includes("No drive") ? 404 : 500)
      return {
        error: "Failed to fetch SMART",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* GET /proxmox/storage/live-token — superuser-only key for the /bay/live WS. */
  @Get("live-token")
  @Response<StorageErrorResponse>(503, "Not configured")
  public async getLiveToken(): Promise<{ data: { token: string } } | StorageErrorResponse> {
    const token = process.env.BAY_VIEW_KEY
    if (!token) {
      this.setStatus(503)
      return { error: "Live bay stream not configured", message: "Set BAY_VIEW_KEY." }
    }
    return { data: { token } }
  }

  /* ---- Actions (via cnet-bayd host agent) ---- */

  private async runCommand(
    req: ExpressRequest,
    action: AuditAction,
    resourceId: string,
    args: Record<string, unknown>,
    verb: "locate" | "spindown" | "zpool"
  ): Promise<ActionResult | StorageErrorResponse> {
    const user = req.user as { id: string }
    const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined
    try {
      const reply = await sendBayCommand(verb, args)
      await logAuditAction({
        userId: user.id,
        action,
        resourceType: "storage",
        resourceId,
        status: reply.ok ? "success" : "failed",
        errorMessage: reply.ok ? undefined : reply.error,
        ipAddress,
      })
      if (!reply.ok) {
        this.setStatus(400)
        return { error: action, message: reply.error }
      }
      return { ok: true, output: reply.output }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await logAuditAction({
        userId: user.id,
        action,
        resourceType: "storage",
        resourceId,
        status: "failed",
        errorMessage: message,
        ipAddress,
      })
      this.setStatus(error instanceof BayCommandError ? 503 : 500)
      return { error: action, message }
    }
  }

  /* POST /proxmox/storage/locate — blink (or clear) a bay's locate LED. */
  @Post("locate")
  @Response<StorageErrorResponse>(400, "Command failed")
  @Response<StorageErrorResponse>(503, "Agent unavailable")
  public async locate(
    @Body() body: LocateBody,
    @Request() req: ExpressRequest
  ): Promise<ActionResult | StorageErrorResponse> {
    return this.runCommand(
      req,
      "STORAGE_LOCATE",
      body.serial,
      { serial: body.serial, on: body.on },
      "locate"
    )
  }

  /* POST /proxmox/storage/spindown — spin a drive down (cold_tank/idle only). */
  @Post("spindown")
  @Response<StorageErrorResponse>(400, "Command failed")
  @Response<StorageErrorResponse>(503, "Agent unavailable")
  public async spindown(
    @Body() body: SpindownBody,
    @Request() req: ExpressRequest
  ): Promise<ActionResult | StorageErrorResponse> {
    return this.runCommand(
      req,
      "STORAGE_SPINDOWN",
      body.serial,
      { serial: body.serial },
      "spindown"
    )
  }

  /* POST /proxmox/storage/zpool — zpool replace/offline/online/scrub. */
  @Post("zpool")
  @Response<StorageErrorResponse>(400, "Command failed")
  @Response<StorageErrorResponse>(403, "Password required/invalid")
  @Response<StorageErrorResponse>(503, "Agent unavailable")
  public async zpool(
    @Body() body: ZpoolBody,
    @Request() req: ExpressRequest
  ): Promise<ActionResult | StorageErrorResponse> {
    if (DESTRUCTIVE.has(body.action) && !StorageController.checkOpPassword(body.password)) {
      this.setStatus(403)
      return {
        error: "Operation password required",
        message: "zpool replace/offline require a valid CNET_STORAGE_OP_PASSWORD.",
      }
    }
    return this.runCommand(
      req,
      ZPOOL_AUDIT[body.action],
      body.pool,
      { action: body.action, pool: body.pool, target: body.target, newTarget: body.newTarget },
      "zpool"
    )
  }
}
