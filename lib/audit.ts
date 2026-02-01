import { db } from "@/db/client"
import { auditLogs } from "@/db/schema"
import type { auditActionEnum } from "@/db/schema"

type AuditAction = (typeof auditActionEnum.enumValues)[number]

interface LogAuditActionParams {
  userId: string
  action: AuditAction
  resourceType: string
  resourceId: string
  changes?: Record<string, unknown>
  status: "success" | "failed"
  errorMessage?: string
  ipAddress?: string
}

/**
 * Log an audit action to the database
 */
export async function logAuditAction(params: LogAuditActionParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      changes: params.changes ? JSON.parse(JSON.stringify(params.changes)) : null,
      status: params.status,
      errorMessage: params.errorMessage || null,
      ipAddress: params.ipAddress || null,
    })
  } catch (error) {
    console.error("Failed to log audit action:", error)
    // Don't throw - audit logging should not break the main flow
  }
}
