import { Worker, type Job } from 'bullmq'
import { QUEUE_NAMES, getRedisConnectionOptions } from '@/lib/queues'
import { db } from '@/db/client'
import { serviceStatuses, serviceCredentials } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getNotificationsQueue } from '@/lib/queues'

interface HealthCheckJobData {
  service?: 'pi-hole' | 'plex' | 'minecraft' | 'nas'
}

interface ServiceHealthCheck {
  service: string
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  errorMessage?: string
}

/**
 * Health check worker.
 * Checks health of Pi-hole, Plex, Minecraft, and NAS services every 2 minutes.
 */
export function createHealthCheckerWorker(): Worker {
  const worker = new Worker<HealthCheckJobData>(
    QUEUE_NAMES.HEALTH_CHECKS,
    async (job: Job<HealthCheckJobData>) => {
      const servicesToCheck = job.data.service
        ? [job.data.service]
        : (['pi-hole', 'plex', 'minecraft', 'nas'] as const)

      const results: ServiceHealthCheck[] = []

      for (const service of servicesToCheck) {
        try {
          const startTime = Date.now()

          // Get service credentials from database
          const credentials = await db.query.serviceCredentials.findFirst({
            where: and(eq(serviceCredentials.service, service)),
          })

          if (!credentials) {
            results.push({
              service,
              status: 'down',
              errorMessage: 'Service credentials not configured',
            })
            continue
          }

          // Perform health check based on service type
          let isHealthy = false
          let errorMessage: string | undefined

          switch (service) {
            case 'pi-hole': {
              isHealthy = await checkPiHole(credentials.hostname, credentials.port)
              break
            }
            case 'plex': {
              isHealthy = await checkPlex(credentials.hostname, credentials.port)
              break
            }
            case 'minecraft': {
              isHealthy = await checkMinecraft(credentials.hostname, credentials.port)
              break
            }
            case 'nas': {
              isHealthy = await checkNAS(credentials.hostname, credentials.port)
              break
            }
          }

          const responseTime = Date.now() - startTime
          const status = isHealthy ? 'up' : 'down'

          results.push({
            service,
            status,
            responseTime,
            errorMessage: isHealthy ? undefined : errorMessage || 'Health check failed',
          })

          // Update service status in database
          await db
            .insert(serviceStatuses)
            .values({
              service,
              status,
              lastCheck: new Date(),
              responseTime,
              errorMessage: isHealthy ? null : errorMessage || 'Health check failed',
            })
            .onConflictDoUpdate({
              target: serviceStatuses.service,
              set: {
                status,
                lastCheck: new Date(),
                responseTime,
                errorMessage: isHealthy ? null : errorMessage || 'Health check failed',
              },
            })

          // If service went down, trigger alert
          if (!isHealthy) {
            const previousStatus = await db.query.serviceStatuses.findFirst({
              where: eq(serviceStatuses.service, service),
            })

            // Only send alert if status changed from up to down
            if (previousStatus?.status === 'up') {
              await getNotificationsQueue().add('service-down', {
                service,
                message: `Service ${service} is now down`,
                responseTime,
                errorMessage,
              })
            }
          }
        } catch (error) {
          console.error(`Health check failed for ${service}:`, error)
          results.push({
            service,
            status: 'down',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString(),
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 24 * 3600,
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`Health check job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Health check job ${job?.id} failed:`, err)
  })

  return worker
}

// Health check functions for each service
async function checkPiHole(hostname: string, port: number): Promise<boolean> {
  try {
    const url = `http://${hostname}:${port}/admin/api.php?summaryRaw&auth=`
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    return response.ok && response.status === 200
  } catch {
    return false
  }
}

async function checkPlex(hostname: string, port: number): Promise<boolean> {
  try {
    const url = `http://${hostname}:${port}/`
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function checkMinecraft(hostname: string, port: number): Promise<boolean> {
  try {
    // Simple TCP connection check - Minecraft server ping
    // In production, you might want to use a Minecraft-specific library
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`http://${hostname}:${port}`, {
      method: 'GET',
      signal: controller.signal as AbortSignal,
    })

    clearTimeout(timeout)
    return response.status < 500 // Accept any non-server-error response
  } catch {
    return false
  }
}

async function checkNAS(hostname: string, port: number): Promise<boolean> {
  try {
    const url = `http://${hostname}:${port}/api/v2.0/system/info`
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}
