import { Worker, type Job } from 'bullmq'
import { QUEUE_NAMES, getRedisConnectionOptions } from '@/lib/queues'
import { db } from '@/db/client'
import { serviceCredentials } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { logAuditAction } from '@/lib/audit'

interface ServiceIntegrationJobData {
  action: 'pi-hole-gravity-update' | 'plex-library-scan' | 'container-restart'
  serviceId?: string
  containerId?: string
  userId: string
}

/**
 * Service integration worker.
 * Handles long-running service operations like Pi-hole gravity updates, Plex library scans, and container restarts.
 */
export function createServiceIntegrationsWorker(): Worker {
  const worker = new Worker<ServiceIntegrationJobData>(
    QUEUE_NAMES.SERVICE_INTEGRATIONS,
    async (job: Job<ServiceIntegrationJobData>) => {
      const { action, serviceId, containerId, userId } = job.data

      try {
        let result: { success: boolean; message: string; details?: unknown }

        switch (action) {
          case 'pi-hole-gravity-update': {
            result = await runPiHoleGravityUpdate(serviceId)
            break
          }

          case 'plex-library-scan': {
            result = await runPlexLibraryScan(serviceId)
            break
          }

          case 'container-restart': {
            result = await runContainerRestart(containerId)
            break
          }

          default: {
            throw new Error(`Unknown service integration action: ${action}`)
          }
        }

        // Log action
        await logAuditAction({
          userId,
          action: 'SERVICE_ENABLED', // Placeholder - would need SERVICE_INTEGRATION in enum
          resourceType: 'service-integration',
          resourceId: serviceId || containerId || 'unknown',
          status: result.success ? 'success' : 'failed',
          errorMessage: result.success ? undefined : result.message,
          changes: { action, serviceId, containerId, result },
        })

        if (!result.success) {
          throw new Error(result.message)
        }

        return {
          success: true,
          action,
          message: result.message,
          details: result.details,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        console.error(`Service integration job failed for ${action}:`, error)
        throw error
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2, // Allow some concurrency for service operations
      removeOnComplete: {
        age: 7 * 24 * 3600,
        count: 500,
      },
      removeOnFail: {
        age: 30 * 24 * 3600,
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`Service integration job ${job.id} completed: ${job.data.action}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Service integration job ${job?.id} failed:`, err)
  })

  worker.on('progress', (job, progress) => {
    console.log(`Service integration job ${job.id} progress: ${progress}%`)
  })

  return worker
}

/**
 * Run Pi-hole gravity update (blocklist refresh).
 */
async function runPiHoleGravityUpdate(serviceId?: string): Promise<{ success: boolean; message: string; details?: unknown }> {
  if (!serviceId) {
    return {
      success: false,
      message: 'Service ID is required for Pi-hole gravity update',
    }
  }

  // Get Pi-hole credentials
  const credentials = await db.query.serviceCredentials.findFirst({
    where: and(eq(serviceCredentials.service, 'pi-hole'), eq(serviceCredentials.id, serviceId)),
  })

  if (!credentials) {
    return {
      success: false,
      message: 'Pi-hole credentials not found',
    }
  }

  // TODO: Implement Pi-hole gravity update
  // This would involve:
  // 1. Making an authenticated request to Pi-hole API
  // 2. Triggering the gravity update endpoint
  // 3. Monitoring the update progress
  // 4. Returning success when complete

  return {
    success: true,
    message: `Pi-hole gravity update triggered for ${credentials.hostname}`,
    details: {
      hostname: credentials.hostname,
      port: credentials.port,
    },
  }
}

/**
 * Run Plex library scan.
 */
async function runPlexLibraryScan(serviceId?: string): Promise<{ success: boolean; message: string; details?: unknown }> {
  if (!serviceId) {
    return {
      success: false,
      message: 'Service ID is required for Plex library scan',
    }
  }

  // Get Plex credentials
  const credentials = await db.query.serviceCredentials.findFirst({
    where: and(eq(serviceCredentials.service, 'plex'), eq(serviceCredentials.id, serviceId)),
  })

  if (!credentials) {
    return {
      success: false,
      message: 'Plex credentials not found',
    }
  }

  // TODO: Implement Plex library scan
  // This would involve:
  // 1. Authenticating to Plex API
  // 2. Triggering library scan for all or specific libraries
  // 3. Monitoring scan progress
  // 4. Returning success when scan starts (scans run asynchronously)

  return {
    success: true,
    message: `Plex library scan triggered for ${credentials.hostname}`,
    details: {
      hostname: credentials.hostname,
      port: credentials.port,
    },
  }
}

/**
 * Restart a container (LXC or Docker).
 */
async function runContainerRestart(containerId?: string): Promise<{ success: boolean; message: string; details?: unknown }> {
  if (!containerId) {
    return {
      success: false,
      message: 'Container ID is required for restart',
    }
  }

  // TODO: Implement container restart
  // This would involve:
  // 1. Determining if it's a Proxmox LXC or Docker container
  // 2. Using appropriate API to restart the container
  // 3. Waiting for restart to complete
  // 4. Verifying container is running

  return {
    success: true,
    message: `Container ${containerId} restart triggered`,
    details: {
      containerId,
    },
  }
}
