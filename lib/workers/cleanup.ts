import { Worker, type Job } from 'bullmq'
import { QUEUE_NAMES, getRedisConnectionOptions } from '@/lib/queues'
import { db } from '@/db/client'
import { metricsSnapshots, auditLogs } from '@/db/schema'
import { lt } from 'drizzle-orm'

interface CleanupJobData {
  type: 'metrics' | 'audit-logs' | 'all'
}

/**
 * Cleanup worker.
 * Handles periodic cleanup tasks like deleting old metrics and pruning audit logs.
 */
export function createCleanupWorker(): Worker {
  const worker = new Worker<CleanupJobData>(
    QUEUE_NAMES.CLEANUP,
    async (job: Job<CleanupJobData>) => {
      const { type } = job.data

      const results: Record<string, number> = {}

      try {
        if (type === 'metrics' || type === 'all') {
          // Delete metrics older than 30 days
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          const deletedMetrics = await db
            .delete(metricsSnapshots)
            .where(lt(metricsSnapshots.timestamp, thirtyDaysAgo))
            .returning()

          results.metricsDeleted = deletedMetrics.length
          console.log(`Deleted ${deletedMetrics.length} metrics older than 30 days`)
        }

        if (type === 'audit-logs' || type === 'all') {
          // Delete audit logs older than 90 days (keep longer than metrics)
          const ninetyDaysAgo = new Date()
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

          const deletedAuditLogs = await db
            .delete(auditLogs)
            .where(lt(auditLogs.timestamp, ninetyDaysAgo))
            .returning()

          results.auditLogsDeleted = deletedAuditLogs.length
          console.log(`Deleted ${deletedAuditLogs.length} audit logs older than 90 days`)
        }

        // Optional: Database compaction/optimization
        // This is database-specific and might not be needed for PostgreSQL
        // For PostgreSQL, you could run VACUUM ANALYZE, but that's typically
        // handled automatically by autovacuum

        return {
          success: true,
          type,
          results,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        console.error('Cleanup job failed:', error)
        throw error
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      removeOnComplete: {
        age: 7 * 24 * 3600,
        count: 100,
      },
      removeOnFail: {
        age: 30 * 24 * 3600,
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`Cleanup job ${job.id} completed: ${job.data.type}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Cleanup job ${job?.id} failed:`, err)
  })

  return worker
}
