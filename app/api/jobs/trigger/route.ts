import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
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

const triggerJobSchema = z.object({
  queue: z.enum([
    QUEUE_NAMES.METRICS,
    QUEUE_NAMES.HEALTH_CHECKS,
    QUEUE_NAMES.BACKUPS,
    QUEUE_NAMES.CLEANUP,
    QUEUE_NAMES.NOTIFICATIONS,
    QUEUE_NAMES.SERVICE_INTEGRATIONS,
  ]),
  jobName: z.string(),
  data: z.record(z.string(), z.unknown()),
})

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const body = await request.json()
    const validated = triggerJobSchema.parse(body)

    // Get appropriate queue
    let queue
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

    // Add userId to job data if not present
    const jobData = {
      ...validated.data,
      userId: validated.data.userId || userId,
    }

    // Add job to queue
    const job = await queue.add(validated.jobName, jobData)

    return NextResponse.json({
      success: true,
      jobId: job.id,
      queue: validated.queue,
      jobName: validated.jobName,
      message: 'Job queued successfully',
    })
  } catch (error) {
    console.error('Failed to trigger job:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: 'Failed to trigger job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
