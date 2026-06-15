import type { Request as ExpressRequest } from "express"
import { Controller, Get, Request, Route, Security } from "tsoa"
import { actorFrom } from "../vault/access"
import { completedUsage } from "../vault/usage"

type VaultMe = {
  quotaBytes: number | null
  usageBytes: number
}

@Route("vault/me")
@Security("jwt")
export class VaultMeController extends Controller {
  /** GET /vault/me — current user's quota and storage usage. */
  @Get()
  public async getMe(@Request() req: ExpressRequest): Promise<VaultMe> {
    const actor = actorFrom(req)
    return {
      quotaBytes: actor.quotaBytes,
      usageBytes: await completedUsage(actor.id),
    }
  }
}
