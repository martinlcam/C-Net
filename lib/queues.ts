import { Queue } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'

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
 * Get Redis connection options for BullMQ.
 * BullMQ manages its own Redis connections internally.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL
  const redisHost = process.env.REDIS_HOST || 'localhost'
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10)

  if (redisUrl) {
    // Parse the URL for connection options
    const url = new URL(redisUrl)
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      username: url.username || undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
    }
  }

  return {
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: null, // Required for BullMQ
  }
}

/**
 * Get or create a BullMQ queue instance.
 */
export function getQueue(queueName: string): Queue {
  const existingQueue = queues.get(queueName)
  if (existingQueue) {
    return existingQueue
  }

  const queue = new Queue(queueName, {
    connection: getRedisConnectionOptions(),
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
