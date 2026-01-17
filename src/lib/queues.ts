import { Queue } from 'bullmq'
import { getRedisClient } from './redis'

// Queue names
export const QUEUE_NAMES = {
  METRICS: 'metrics',
  HEALTH_CHECKS: 'health-checks',
  BACKUPS: 'backups',
  CLEANUP: 'cleanup',
  NOTIFICATIONS: 'notifications',
  SERVICE_INTEGRATIONS: 'service-integrations',
} as const

// Queue instances (singletons)
const queues: Map<string, Queue> = new Map()

/**
 * Get or create a BullMQ queue instance.
 */
export function getQueue(queueName: string): Queue {
  if (queues.has(queueName)) {
    return queues.get(queueName)!
  }

  const queue = new Queue(queueName, {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  })

  queues.set(queueName, queue)
  return queue
}

/**
 * Get the metrics collection queue.
 */
export function getMetricsQueue(): Queue {
  return getQueue(QUEUE_NAMES.METRICS)
}

/**
 * Get the health checks queue.
 */
export function getHealthChecksQueue(): Queue {
  return getQueue(QUEUE_NAMES.HEALTH_CHECKS)
}

/**
 * Get the backups queue.
 */
export function getBackupsQueue(): Queue {
  return getQueue(QUEUE_NAMES.BACKUPS)
}

/**
 * Get the cleanup queue.
 */
export function getCleanupQueue(): Queue {
  return getQueue(QUEUE_NAMES.CLEANUP)
}

/**
 * Get the notifications queue.
 */
export function getNotificationsQueue(): Queue {
  return getQueue(QUEUE_NAMES.NOTIFICATIONS)
}

/**
 * Get the service integrations queue.
 */
export function getServiceIntegrationsQueue(): Queue {
  return getQueue(QUEUE_NAMES.SERVICE_INTEGRATIONS)
}

/**
 * Close all queue connections gracefully.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((queue) => queue.close())
  await Promise.all(closePromises)
  queues.clear()
}
