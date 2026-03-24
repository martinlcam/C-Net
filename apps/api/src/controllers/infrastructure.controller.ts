import { encrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import { testProxmoxConnection } from "@cnet/engine"
import { eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Post, Request, Response, Route, Security } from "tsoa"

interface InfrastructureConfigBody {
  proxmoxHost: string
  proxmoxUser: string
  proxmoxToken: string
  proxmoxVerifySSL?: boolean
}

interface InfraErrorResponse {
  error: string
  message?: string
  details?: unknown
}

@Route("infrastructure")
@Security("jwt")
export class InfrastructureController extends Controller {
  /* GET /infrastructure/config */
  @Get("config")
  @Response<InfraErrorResponse>(404, "Config not found")
  @Response<InfraErrorResponse>(500, "Server error")
  public async getConfig(
    @Request() req: ExpressRequest
  ): Promise<{ data: unknown } | InfraErrorResponse> {
    try {
      const user = req.user as { id: string }

      const config = await db.query.infrastructureConfigs.findFirst({
        where: eq(infrastructureConfigs.userId, user.id),
      })

      if (!config) {
        this.setStatus(404)
        return { error: "Configuration not found" }
      }

      /* Return config without token for security */
      return {
        data: {
          id: config.id,
          proxmoxHost: config.proxmoxHost,
          proxmoxUser: config.proxmoxUser,
          proxmoxVerifySSL: config.proxmoxVerifySSL,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      }
    } catch (error) {
      console.error("Failed to fetch infrastructure config:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch configuration",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* POST /infrastructure/config */
  @Post("config")
  @Response<InfraErrorResponse>(400, "Validation or connection test failed")
  @Response<InfraErrorResponse>(500, "Server error")
  public async saveConfig(
    @Body() body: InfrastructureConfigBody,
    @Request() req: ExpressRequest
  ): Promise<{ data: unknown; message: string } | InfraErrorResponse> {
    try {
      const user = req.user as { id: string }

      /* Test connection before saving */
      const connectionTest = await testProxmoxConnection(
        body.proxmoxHost,
        body.proxmoxUser,
        body.proxmoxToken,
        body.proxmoxVerifySSL ?? false
      )

      if (!connectionTest.success) {
        this.setStatus(400)
        return {
          error: "Connection test failed",
          message: connectionTest.message,
        }
      }

      /* Encrypt token */
      const password = getEncryptionPassword()
      const encryptedToken = await encrypt(body.proxmoxToken, password)

      /* Check if config exists */
      const existing = await db.query.infrastructureConfigs.findFirst({
        where: eq(infrastructureConfigs.userId, user.id),
      })

      if (existing) {
        /* Update existing config */
        const [updated] = await db
          .update(infrastructureConfigs)
          .set({
            proxmoxHost: body.proxmoxHost,
            proxmoxUser: body.proxmoxUser,
            proxmoxToken: encryptedToken,
            proxmoxVerifySSL: body.proxmoxVerifySSL ?? false,
            updatedAt: new Date(),
          })
          .where(eq(infrastructureConfigs.id, existing.id))
          .returning()

        return { data: updated, message: "Configuration updated" }
      } else {
        /* Create new config */
        const [created] = await db
          .insert(infrastructureConfigs)
          .values({
            userId: user.id,
            proxmoxHost: body.proxmoxHost,
            proxmoxUser: body.proxmoxUser,
            proxmoxToken: encryptedToken,
            proxmoxVerifySSL: body.proxmoxVerifySSL ?? false,
          })
          .returning()

        this.setStatus(201)
        return { data: created, message: "Configuration created" }
      }
    } catch (error) {
      console.error("Failed to save infrastructure config:", error)
      this.setStatus(500)
      return {
        error: "Failed to save configuration",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
