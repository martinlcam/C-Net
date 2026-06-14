import { getAllowlistEntry, type VaultRole } from "@cnet/core"
import type { Request as ExpressRequest } from "express"

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export type VaultActor = {
  id: string
  email: string
  role: VaultRole
  quotaBytes: number | null
}

/** Resolve the calling user's vault role + quota from the allowlist (source of truth). */
export function actorFrom(req: ExpressRequest): VaultActor {
  const user = req.user as { id: string; email: string }
  const entry = getAllowlistEntry(user.email)
  if (!entry) throw new ForbiddenError("Not authorized for vault")
  return { id: user.id, email: user.email, role: entry.role, quotaBytes: entry.quotaBytes }
}

export function requireSuper(actor: VaultActor): void {
  if (actor.role !== "super") throw new ForbiddenError("Superuser only")
}
