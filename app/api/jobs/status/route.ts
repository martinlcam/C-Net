import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import type { Queue } from 'bullmq'
import {
  getMetricsQueue,
  getHealthChecksQueue,
  getBackupsQueue,
  getCleanupQueue,
  getNotificationsQueue,
  getServiceIntegrationsQueue,
  QUEUE_NAMES,
} from '@/lib/queues'

export const dynamic = 'force-dynamic'

const statusQuerySchema = z.object({
  queue: z.enum([
    QUEUE_NAMES.METRICS,
    QUEUE_NAMES.HEALTH_CHECKS,
    QUEUE_NAMES.BACKUPS,
    QUEUE_NAMES.CLEANUP,
    QUEUE_NAMES.NOTIFICATIONS,
    QUEUE_NAMES.SERVICE_INTEGRATIONS,
  ]),
  jobId: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const validated = statusQuerySchema.parse({
      queue: searchParams.get('queue') || undefined,
      jobId: searchParams.get('jobId') || undefined,
    })

    // Get appropriate queue
    let queue: Queue
    switch (validated.queue) {
      case QUEUE_NAMES.METRICS:
        queue = getMetricsQueue()
        break
      case QUEUE_NAMES.HEALTH_CHECKS:
        queue = getHealthChecksQueue()
        break
      case QUEUE_NAMES.BACKUPS:
        queue = getBackupsQueue()
        break
      case QUEUE_NAMES.CLEANUP:
        queue = getCleanupQueue()
        break
      case QUEUE_NAMES.NOTIFICATIONS:
        queue = getNotificationsQueue()
        break
      case QUEUE_NAMES.SERVICE_INTEGRATIONS:
        queue = getServiceIntegrationsQueue()
        break
    }

    if (validated.jobId) {
      // Get specific job status
      const job = await queue.getJob(validated.jobId)

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      const state = await job.getState()
      const progress = job.progress

      return NextResponse.json({
        jobId: job.id,
        queue: validated.queue,
        state,
        progress,
        data: job.data,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })
    } else {
      // Get queue stats
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ])

      return NextResponse.json({
        queue: validated.queue,
        stats: {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed,
        },
      })
    }
  } catch (error) {
    console.error('Failed to get job status:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
