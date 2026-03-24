import {
  getBackupsQueue,
  getCleanupQueue,
  getHealthChecksQueue,
  getMetricsQueue,
  getNotificationsQueue,
  getServiceIntegrationsQueue,
  QUEUE_NAMES,
} from "@cnet/core"
import type { Queue } from "bullmq"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Post, Query, Request, Response, Route, Security } from "tsoa"

type QueueName =
  | "metrics"
  | "health-checks"
  | "backups"
  | "cleanup"
  | "notifications"
  | "service-integrations"

interface TriggerJobBody {
  queue: QueueName
  jobName: string
  data: Record<string, unknown>
}

interface JobsErrorResponse {
  error: string
  message?: string
  details?: unknown
}

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  total: number
}

@Route("jobs")
@Security("jwt")
export class JobsController extends Controller {
  /* Resolve a queue name to its BullMQ Queue instance */
  private getQueueByName(name: QueueName): Queue {
    switch (name) {
      case QUEUE_NAMES.METRICS:
        return getMetricsQueue()
      case QUEUE_NAMES.HEALTH_CHECKS:
        return getHealthChecksQueue()
      case QUEUE_NAMES.BACKUPS:
        return getBackupsQueue()
      case QUEUE_NAMES.CLEANUP:
        return getCleanupQueue()
      case QUEUE_NAMES.NOTIFICATIONS:
        return getNotificationsQueue()
      case QUEUE_NAMES.SERVICE_INTEGRATIONS:
        return getServiceIntegrationsQueue()
    }
  }

  /* POST /jobs/trigger — add a job to a queue */
  @Post("trigger")
  @Response<JobsErrorResponse>(500, "Server error")
  public async triggerJob(
    @Body() body: TriggerJobBody,
    @Request() req: ExpressRequest
  ): Promise<
    | {
        success: boolean
        jobId: string | undefined
        queue: string
        jobName: string
        message: string
      }
    | JobsErrorResponse
  > {
    try {
      const user = req.user as { id: string }
      const queue = this.getQueueByName(body.queue)

      /* Add userId to job data if not present */
      const jobData = {
        ...body.data,
        userId: body.data.userId || user.id,
      }

      /* Add job to queue */
      const job = await queue.add(body.jobName, jobData)

      return {
        success: true,
        jobId: job.id,
        queue: body.queue,
        jobName: body.jobName,
        message: "Job queued successfully",
      }
    } catch (error) {
      console.error("Failed to trigger job:", error)
      this.setStatus(500)
      return {
        error: "Failed to trigger job",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* GET /jobs/metrics — get metrics for all queues */
  @Get("metrics")
  @Response<JobsErrorResponse>(500, "Server error")
  public async getQueueMetrics(): Promise<
    | {
        success: boolean
        metrics: { queue: string; stats: QueueStats }[]
        timestamp: string
      }
    | JobsErrorResponse
  > {
    try {
      const queues = [
        getMetricsQueue(),
        getHealthChecksQueue(),
        getBackupsQueue(),
        getCleanupQueue(),
        getNotificationsQueue(),
        getServiceIntegrationsQueue(),
      ]

      const queueNames = [
        "metrics",
        "health-checks",
        "backups",
        "cleanup",
        "notifications",
        "service-integrations",
      ]

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
            queue: queueNames[index] || "unknown",
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

      return {
        success: true,
        metrics,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Failed to get queue metrics:", error)
      this.setStatus(500)
      return {
        error: "Failed to get queue metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /* GET /jobs/status — get queue stats or specific job status */
  @Get("status")
  @Response<JobsErrorResponse>(404, "Job not found")
  @Response<JobsErrorResponse>(500, "Server error")
  public async getJobStatus(
    @Query() queue: QueueName,
    @Query() jobId?: string
  ): Promise<unknown | JobsErrorResponse> {
    try {
      const q = this.getQueueByName(queue)

      if (jobId) {
        /* Get specific job status */
        const job = await q.getJob(jobId)

        if (!job) {
          this.setStatus(404)
          return { error: "Job not found" }
        }

        const state = await job.getState()
        const progress = job.progress

        return {
          jobId: job.id,
          queue,
          state,
          progress,
          data: job.data,
          returnvalue: job.returnvalue,
          failedReason: job.failedReason,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        }
      } else {
        /* Get queue stats */
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getCompletedCount(),
          q.getFailedCount(),
          q.getDelayedCount(),
        ])

        return {
          queue,
          stats: {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
          },
        }
      }
    } catch (error) {
      console.error("Failed to get job status:", error)
      this.setStatus(500)
      return {
        error: "Failed to get job status",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
