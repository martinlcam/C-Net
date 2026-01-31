import { getMetricsQueue, getHealthChecksQueue, getCleanupQueue } from '@/lib/queues'
import { createMetricsCollectorWorker } from './metrics-collector'
import { createHealthCheckerWorker } from './health-checker'
import { createBackupRunnerWorker } from './backup-runner'
import { createCleanupWorker } from './cleanup'
import { createNotificationSenderWorker } from './notification-sender'
import { createServiceIntegrationsWorker } from './service-integrations'
import { db } from '@/db/client'
import { infrastructureConfigs } from '@/db/schema'

let workers: Array<{ name: string; worker: unknown }> = []
let isShuttingDown = false

/**
 * Initialize all workers and start scheduled jobs.
 */
export async function initializeWorkers(): Promise<void> {
  try {
    // Create all workers
    const metricsWorker = createMetricsCollectorWorker()
    const healthWorker = createHealthCheckerWorker()
    const backupWorker = createBackupRunnerWorker()
    const cleanupWorker = createCleanupWorker()
    const notificationWorker = createNotificationSenderWorker()
    const integrationWorker = createServiceIntegrationsWorker()

    workers = [
      { name: 'metrics', worker: metricsWorker },
      { name: 'health-checks', worker: healthWorker },
      { name: 'backups', worker: backupWorker },
      { name: 'cleanup', worker: cleanupWorker },
      { name: 'notifications', worker: notificationWorker },
      { name: 'service-integrations', worker: integrationWorker },
    ]

    // Set up scheduled/repeatable jobs
    await setupScheduledJobs()

    console.log('All workers initialized successfully')
  } catch (error) {
    console.error('Failed to initialize workers:', error)
    throw error
  }
}

/**
 * Set up scheduled/repeatable jobs using BullMQ QueueScheduler.
 */
async function setupScheduledJobs(): Promise<void> {
  // Get all users with Proxmox configs for metrics collection
  const configs = await db.query.infrastructureConfigs.findMany({})

  // Metrics collection every 30 seconds for each user with config
  const metricsQueue = getMetricsQueue()
  for (const config of configs) {
    await metricsQueue.add(
      'collect-metrics',
      { userId: config.userId },
      {
        repeat: {
          every: 30 * 1000, // 30 seconds
        },
        jobId: `metrics-collection-${config.userId}`,
      }
    )
  }

  // Health checks every 2 minutes
  const healthQueue = getHealthChecksQueue()
  await healthQueue.add(
    'check-all-services',
    {},
    {
      repeat: {
        every: 2 * 60 * 1000, // 2 minutes
      },
      jobId: 'health-checks-repeat',
    }
  )

  // Cleanup daily at 2 AM
  const cleanupQueue = getCleanupQueue()
  await cleanupQueue.add(
    'cleanup-all',
    { type: 'all' },
    {
      repeat: {
        pattern: '0 2 * * *', // Cron pattern: daily at 2 AM
      },
      jobId: 'cleanup-daily-repeat',
    }
  )
}

/**
 * Gracefully shutdown all workers.
 */
export async function shutdownWorkers(): Promise<void> {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  console.log('Shutting down workers...')

  const shutdownPromises = workers.map(async ({ name, worker }) => {
    try {
      if (worker && typeof worker === 'object' && 'close' in worker) {
        await (worker as { close: () => Promise<void> }).close()
      }
      console.log(`Worker ${name} closed`)
    } catch (error) {
      console.error(`Error closing worker ${name}:`, error)
    }
  })

  await Promise.all(shutdownPromises)
  workers = []
  console.log('All workers shut down')
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownWorkers()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await shutdownWorkers()
  process.exit(0)
})
