import { decrypt, encrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { serviceCredentials } from "@cnet/db/schema"
import { testServiceConnection } from "@cnet/engine"
import { and, eq } from "drizzle-orm"
import type { Request as ExpressRequest } from "express"
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Request,
  Response,
  Route,
  Security,
} from "tsoa"

type ServiceType = "pi-hole" | "plex" | "minecraft" | "nas"

interface CreateCredentialBody {
  service: ServiceType
  hostname: string
  port: number
  apiKey?: string
}

interface UpdateCredentialBody {
  hostname?: string
  port?: number
  apiKey?: string
}

interface TestCredentialBody {
  credentialId?: string
  service?: ServiceType
  hostname?: string
  port?: number
  apiKey?: string
}

interface CredentialResponse {
  id: string
  service: string
  hostname: string
  port: number
  createdAt: Date
}

interface ServicesErrorResponse {
  error: string
  message?: string
  details?: unknown
}

@Route("services/credentials")
@Security("jwt")
export class ServicesController extends Controller {
  /* GET /services/credentials — list all credentials for user */
  @Get()
  @Response<ServicesErrorResponse>(500, "Server error")
  public async listCredentials(
    @Request() req: ExpressRequest
  ): Promise<{ data: CredentialResponse[] } | ServicesErrorResponse> {
    try {
      const user = req.user as { id: string }

      const credentials = await db.query.serviceCredentials.findMany({
        where: eq(serviceCredentials.userId, user.id),
        orderBy: (credentials, { asc }) => [asc(credentials.service), asc(credentials.createdAt)],
      })

      /* Return credentials without decrypted API keys for security */
      const safeCredentials = credentials.map((cred) => ({
        id: cred.id,
        service: cred.service,
        hostname: cred.hostname,
        port: cred.port,
        createdAt: cred.createdAt,
      }))

      return { data: safeCredentials }
    } catch (error) {
      console.error("Failed to fetch service credentials:", error)
      this.setStatus(500)
      return {
        error: "Failed to fetch credentials",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* POST /services/credentials — create a new credential */
  @Post()
  @Response<ServicesErrorResponse>(400, "Validation failed")
  @Response<ServicesErrorResponse>(409, "Credential already exists")
  @Response<ServicesErrorResponse>(500, "Server error")
  public async createCredential(
    @Body() body: CreateCredentialBody,
    @Request() req: ExpressRequest
  ): Promise<{ data: CredentialResponse; message: string } | ServicesErrorResponse> {
    try {
      const user = req.user as { id: string }

      /* Validate API key requirement based on service type */
      if (body.service !== "minecraft" && !body.apiKey) {
        this.setStatus(400)
        return { error: "API key is required for this service type" }
      }

      /* Check if user already has a credential for this service type */
      const existing = await db.query.serviceCredentials.findFirst({
        where: and(
          eq(serviceCredentials.userId, user.id),
          eq(serviceCredentials.service, body.service)
        ),
      })

      if (existing) {
        this.setStatus(409)
        return {
          error: `A credential for ${body.service} already exists. Please update or delete it first.`,
        }
      }

      /* Encrypt API key before storing */
      const password = getEncryptionPassword()
      const encryptedApiKey = body.apiKey ? await encrypt(body.apiKey, password) : ""

      /* Create new credential */
      const [created] = await db
        .insert(serviceCredentials)
        .values({
          userId: user.id,
          service: body.service,
          hostname: body.hostname,
          port: body.port,
          apiKey: encryptedApiKey,
        })
        .returning()

      if (!created) {
        this.setStatus(500)
        return { error: "Failed to create credential" }
      }

      this.setStatus(201)
      return {
        data: {
          id: created.id,
          service: created.service,
          hostname: created.hostname,
          port: created.port,
          createdAt: created.createdAt,
        },
        message: "Credential created successfully",
      }
    } catch (error) {
      console.error("Failed to create service credential:", error)
      this.setStatus(500)
      return {
        error: "Failed to create credential",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* PATCH /services/credentials/{id} — update an existing credential */
  @Patch("{id}")
  @Response<ServicesErrorResponse>(404, "Not found")
  @Response<ServicesErrorResponse>(500, "Server error")
  public async updateCredential(
    @Path() id: string,
    @Body() body: UpdateCredentialBody,
    @Request() req: ExpressRequest
  ): Promise<{ data: CredentialResponse; message: string } | ServicesErrorResponse> {
    try {
      const user = req.user as { id: string }

      /* Verify the credential belongs to the user */
      const existing = await db.query.serviceCredentials.findFirst({
        where: and(eq(serviceCredentials.id, id), eq(serviceCredentials.userId, user.id)),
      })

      if (!existing) {
        this.setStatus(404)
        return { error: "Credential not found" }
      }

      /* Prepare update data */
      const updateData: {
        hostname?: string
        port?: number
        apiKey?: string
      } = {}

      if (body.hostname !== undefined) {
        updateData.hostname = body.hostname
      }

      if (body.port !== undefined) {
        updateData.port = body.port
      }

      /* Encrypt API key if provided */
      if (body.apiKey !== undefined) {
        const password = getEncryptionPassword()
        updateData.apiKey = body.apiKey ? await encrypt(body.apiKey, password) : ""
      }

      /* Update the credential */
      const [updated] = await db
        .update(serviceCredentials)
        .set(updateData)
        .where(eq(serviceCredentials.id, id))
        .returning()

      if (!updated) {
        this.setStatus(500)
        return { error: "Failed to update credential" }
      }

      return {
        data: {
          id: updated.id,
          service: updated.service,
          hostname: updated.hostname,
          port: updated.port,
          createdAt: updated.createdAt,
        },
        message: "Credential updated successfully",
      }
    } catch (error) {
      console.error("Failed to update service credential:", error)
      this.setStatus(500)
      return {
        error: "Failed to update credential",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* DELETE /services/credentials/{id} — delete a credential */
  @Delete("{id}")
  @Response<ServicesErrorResponse>(404, "Not found")
  @Response<ServicesErrorResponse>(500, "Server error")
  public async deleteCredential(
    @Path() id: string,
    @Request() req: ExpressRequest
  ): Promise<{ message: string } | ServicesErrorResponse> {
    try {
      const user = req.user as { id: string }

      /* Verify the credential belongs to the user */
      const existing = await db.query.serviceCredentials.findFirst({
        where: and(eq(serviceCredentials.id, id), eq(serviceCredentials.userId, user.id)),
      })

      if (!existing) {
        this.setStatus(404)
        return { error: "Credential not found" }
      }

      /* Delete the credential */
      await db.delete(serviceCredentials).where(eq(serviceCredentials.id, id))

      return { message: "Credential deleted successfully" }
    } catch (error) {
      console.error("Failed to delete service credential:", error)
      this.setStatus(500)
      return {
        error: "Failed to delete credential",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* POST /services/credentials/test — test a service connection */
  @Post("test")
  @Response<ServicesErrorResponse>(400, "Validation failed")
  @Response<ServicesErrorResponse>(404, "Credential not found")
  @Response<ServicesErrorResponse>(500, "Server error")
  public async testConnection(
    @Body() body: TestCredentialBody,
    @Request() req: ExpressRequest
  ): Promise<
    { success: boolean; message?: string; responseTime?: number } | ServicesErrorResponse
  > {
    try {
      const user = req.user as { id: string }

      let service: ServiceType
      let hostname: string
      let port: number
      let apiKey: string | undefined

      if (body.credentialId) {
        /* Fetch credential from database */
        const credential = await db.query.serviceCredentials.findFirst({
          where: and(
            eq(serviceCredentials.id, body.credentialId),
            eq(serviceCredentials.userId, user.id)
          ),
        })

        if (!credential) {
          this.setStatus(404)
          return { error: "Credential not found" }
        }

        service = credential.service as ServiceType
        hostname = credential.hostname
        port = credential.port

        /* Decrypt API key for testing */
        const password = getEncryptionPassword()
        apiKey = credential.apiKey ? await decrypt(credential.apiKey, password) : undefined
      } else {
        /* Use provided credentials */
        if (!body.service || !body.hostname || !body.port) {
          this.setStatus(400)
          return {
            error: "Either credentialId or service + hostname + port must be provided",
          }
        }

        service = body.service
        hostname = body.hostname
        port = body.port
        apiKey = body.apiKey
      }

      /* Test the connection */
      const result = await testServiceConnection(service, hostname, port, apiKey)

      return {
        success: result.success,
        message: result.message,
        responseTime: result.responseTime,
      }
    } catch (error) {
      console.error("Failed to test service connection:", error)
      this.setStatus(500)
      return {
        error: "Failed to test connection",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
