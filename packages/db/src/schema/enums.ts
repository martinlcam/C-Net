import { pgEnum } from "drizzle-orm/pg-core"

export const auditActionEnum = pgEnum("audit_action", [
  "VM_CREATED",
  "VM_STARTED",
  "VM_STOPPED",
  "VM_DELETED",
  "VM_RESTARTED",
  "LXC_CREATED",
  "LXC_STARTED",
  "LXC_STOPPED",
  "LXC_DELETED",
  "STORAGE_EXPANDED",
  "CONFIG_UPDATED",
  "SERVICE_ENABLED",
  "SERVICE_DISABLED",
])
export const serviceEnum = pgEnum("service_type", ["pi-hole", "plex", "minecraft", "nas"])
export const statusEnum = pgEnum("service_status", ["up", "down", "degraded"])
export const logStatusEnum = pgEnum("log_status", ["success", "failed"])
