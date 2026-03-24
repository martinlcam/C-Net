import { decrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import { ProxmoxService } from "@cnet/engine"
import { eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Controller, Get, Request, Response, Route, Security } from "tsoa"

interface MetricsErrorResponse {
  error: string
  message?: string
}

@Route("metrics")
@Security("jwt")
export class MetricsController extends Controller {
  /* GET /metrics/current */
  @Get("current")
  @Response<MetricsErrorResponse>(404, "Config not found")
  @Response<MetricsErrorResponse>(500, "Server error")
  public async getCurrentMetrics(
    @Request() req: ExpressRequest
  ): Promise<{ data: { nodes: unknown[]; timestamp: string } } | MetricsErrorResponse> {
    try {
      const user = req.user as { id: string }

      const config = await db.query.infrastructureConfigs.findFirst({
        where: eq(infrastructureConfigs.userId, user.id),
      })

      if (!config) {
        this.setStatus(404)
        return { error: "Proxmox configuration not found" }
      }

      const password = getEncryptionPassword()
      const token = await decrypt(config.proxmoxToken, password)

      const proxmox = new ProxmoxService(config.proxmoxHost, config.proxmoxUser, token)

      const nodes = await proxmox.getNodes()
      const metrics = await Promise.all(
        nodes.map(async (node) => {
          try {
            const nodeMetrics = await proxmox.getNodeStatus(node.node)
            return nodeMetrics
          } catch (error) {
            console.error(`Failed to get metrics for node ${node.node}:`, error)
            return null
          }
        })
      )

      return {
        data: {
          nodes: metrics.filter((m) => m !== null),
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
