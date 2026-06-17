import { ProxmoxService } from "@cnet/engine"
import { Controller, Get, Path, Response, Route, Security, Tags } from "tsoa"

interface StorageErrorResponse {
  error: string
  message?: string
}

/*
 * Host-global ZFS / 12-bay storage view for the proxbox node. Read-only (Phase 1):
 * everything here comes from the Proxmox REST API. Action verbs (locate, spindown,
 * zpool ops) land later via the host-side `cnet-bayd` agent. See
 * docs/ZFS_BAY_GUI_PLAN.md.
 *
 * Storage is host-global, not per-user, so it uses a single service token from the
 * environment (CNET_STORAGE_PVE_*) rather than the per-user `infrastructureConfigs`.
 * Gated to the allowlisted superuser via the `superuser` JWT scope.
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

  /* GET /proxmox/storage/bays — calibrated 12-bay view. */
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

  /* GET /proxmox/storage/pools — every ZFS pool's status + resilver state. */
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

  /* GET /proxmox/storage/disks/{serial}/smart — parsed SMART for one drive. */
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
}
