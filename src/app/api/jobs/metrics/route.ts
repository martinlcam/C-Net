import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  getMetricsQueue,
  getHealthChecksQueue,
  getBackupsQueue,
  getCleanupQueue,
  getNotificationsQueue,
  getServiceIntegrationsQueue,
} from '@/lib/queues'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAuth()

    // Get metrics for all queues
    const queues = [
      getMetricsQueue(),
      getHealthChecksQueue(),
      getBackupsQueue(),
      getCleanupQueue(),
      getNotificationsQueue(),
      getServiceIntegrationsQueue(),
    ]

    const queueNames = ['metrics', 'health-checks', 'backups', 'cleanup', 'notifications', 'service-integrations']

    const metrics = await Promise.all(
      queues.map(async (queue, index) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ])

        return {
          queue: queueNames[index],
          stats: {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
          },
        }
      })
    )

    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get queue metrics:', error)
    return NextResponse.json(
      {
        error: 'Failed to get queue metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
