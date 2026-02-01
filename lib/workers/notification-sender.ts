import { Worker, type Job } from 'bullmq'
import { QUEUE_NAMES, getRedisConnectionOptions } from '@/lib/queues'
import { sendEmail } from '@/lib/resend'

interface NotificationJobData {
  type: 'service-down' | 'disk-usage' | 'custom'
  service?: string
  message: string
  responseTime?: number
  errorMessage?: string
  diskUsagePercent?: number
  recipient?: string
}

/**
 * Notification sender worker.
 * Sends email alerts via Resend when services go down or other critical events occur.
 */
export function createNotificationSenderWorker(): Worker {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotificationJobData>) => {
      const { type, message, service, responseTime, errorMessage, diskUsagePercent, recipient } = job.data

      try {
        // Default recipient is the authorized email (martinlucam@gmail.com)
        const to = recipient || 'martinlucam@gmail.com'

        let subject: string
        let htmlBody: string
        let textBody: string

        switch (type) {
          case 'service-down': {
            subject = `Alert: ${service || 'Service'} is Down`
            htmlBody = `
              <h2>Service Down Alert</h2>
              <p><strong>Service:</strong> ${service || 'Unknown'}</p>
              <p><strong>Message:</strong> ${message}</p>
              ${responseTime ? `<p><strong>Response Time:</strong> ${responseTime}ms</p>` : ''}
              ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : ''}
              <p><em>Timestamp: ${new Date().toISOString()}</em></p>
            `
            textBody = `Service Down Alert\n\nService: ${service || 'Unknown'}\nMessage: ${message}\n${
              responseTime ? `Response Time: ${responseTime}ms\n` : ''
            }${errorMessage ? `Error: ${errorMessage}\n` : ''}\nTimestamp: ${new Date().toISOString()}`
            break
          }

          case 'disk-usage': {
            subject = `Alert: Disk Usage at ${diskUsagePercent}%`
            htmlBody = `
              <h2>High Disk Usage Alert</h2>
              <p><strong>Disk Usage:</strong> ${diskUsagePercent}%</p>
              <p><strong>Message:</strong> ${message}</p>
              <p><em>Timestamp: ${new Date().toISOString()}</em></p>
            `
            textBody = `High Disk Usage Alert\n\nDisk Usage: ${diskUsagePercent}%\nMessage: ${message}\n\nTimestamp: ${new Date().toISOString()}`
            break
          }

          case 'custom': {
            subject = `C-Net Alert: ${message.substring(0, 50)}`
            htmlBody = `
              <h2>C-Net Alert</h2>
              <p>${message}</p>
              <p><em>Timestamp: ${new Date().toISOString()}</em></p>
            `
            textBody = `C-Net Alert\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`
            break
          }

          default: {
            throw new Error(`Unknown notification type: ${type}`)
          }
        }

        // Send email
        const emailResult = await sendEmail({
          to,
          subject,
          html: htmlBody,
          text: textBody,
        })

        return {
          success: true,
          type,
          messageId: emailResult.id,
          recipient: to,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        console.error('Notification job failed:', error)

        // If email fails, we still want to track it but not retry indefinitely
        // BullMQ will handle retries based on job options
        throw error
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5, // Can send multiple notifications concurrently
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep completed notifications for 7 days
        count: 500,
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // Keep failed notifications for 30 days
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed: ${job.data.type}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err)
  })

  return worker
}
