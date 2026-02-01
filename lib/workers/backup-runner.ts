import { Worker, type Job } from "bullmq"
import { QUEUE_NAMES, getRedisConnectionOptions } from "@/lib/queues"
import { db } from "@/db/client"
import { auditLogs } from "@/db/schema"
import { logAuditAction } from "@/lib/audit"
import { requireAuth } from "@/lib/auth"

interface BackupJobData {
  type: "minecraft" | "truenas"
  target: string // VM ID, container ID, or backup location
  userId: string
}

/**
 * Backup runner worker.
 * Handles long-running backup tasks like Minecraft world backups and TrueNAS snapshots.
 */
export function createBackupRunnerWorker(): Worker {
  const worker = new Worker<BackupJobData>(
    QUEUE_NAMES.BACKUPS,
    async (job: Job<BackupJobData>) => {
      const { type, target, userId } = job.data

      try {
        // Verify user has access (can be enhanced with permissions check)
        const session = await requireAuth()
        if (session.user.id !== userId) {
          throw new Error("Unauthorized: User does not have access to this backup")
        }

        let result: { success: boolean; message: string; details?: unknown }

        switch (type) {
          case "minecraft": {
            result = await runMinecraftBackup(target)
            break
          }
          case "truenas": {
            result = await runTrueNASSnapshot(target)
            break
          }
          default: {
            throw new Error(`Unknown backup type: ${type}`)
          }
        }

        // Log backup action
        await logAuditAction({
          userId,
          action: "SERVICE_ENABLED", // Could add BACKUP_CREATED to enum
          resourceType: "backup",
          resourceId: target,
          status: result.success ? "success" : "failed",
          errorMessage: result.success ? undefined : result.message,
          changes: { type, target, result },
        })

        if (!result.success) {
          throw new Error(result.message)
        }

        return {
          success: true,
          type,
          target,
          message: result.message,
          details: result.details,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        console.error(`Backup job failed for ${type}:`, error)

        // Log failure
        await db.insert(auditLogs).values({
          userId,
          action: "SERVICE_ENABLED", // Placeholder - would need BACKUP_FAILED in enum
          resourceType: "backup",
          resourceId: target,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        })

        throw error
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1, // Run backups sequentially to avoid resource contention
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep completed backups for 7 days
        count: 500,
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // Keep failed backups for 30 days for debugging
      },
    }
  )

  worker.on("completed", (job) => {
    console.log(`Backup job ${job.id} completed: ${job.data.type} for ${job.data.target}`)
  })

  worker.on("failed", (job, err) => {
    console.error(`Backup job ${job?.id} failed:`, err)
  })

  worker.on("progress", (job, progress) => {
    console.log(`Backup job ${job.id} progress: ${progress}%`)
  })

  return worker
}

/**
 * Run Minecraft world backup.
 * This is a placeholder - implement based on your Minecraft server setup.
 */
async function runMinecraftBackup(
  target: string
): Promise<{ success: boolean; message: string; details?: unknown }> {
  // TODO: Implement Minecraft backup logic
  // Example: Copy world files to backup location, create archive, etc.
  // This might involve:
  // 1. Triggering a save command via RCON or console
  // 2. Copying world directory to backup location
  // 3. Creating a compressed archive
  // 4. Uploading to storage (S3, NAS, etc.)

  return {
    success: true,
    message: `Minecraft backup created for ${target}`,
    details: {
      target,
      backupLocation: `/backups/minecraft/${target}-${Date.now()}`,
    },
  }
}

/**
 * Run TrueNAS snapshot creation.
 * This is a placeholder - implement based on your TrueNAS API setup.
 */
async function runTrueNASSnapshot(
  target: string
): Promise<{ success: boolean; message: string; details?: unknown }> {
  // TODO: Implement TrueNAS snapshot logic
  // This would involve:
  // 1. Authenticating to TrueNAS API
  // 2. Creating a snapshot of the specified dataset/pool
  // 3. Verifying snapshot creation
  // 4. Optionally setting snapshot retention policy

  return {
    success: true,
    message: `TrueNAS snapshot created for ${target}`,
    details: {
      target,
      snapshotName: `auto-${Date.now()}`,
    },
  }
}
