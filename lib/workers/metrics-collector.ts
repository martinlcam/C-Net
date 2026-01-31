import { Worker, Job } from 'bullmq'
import { QUEUE_NAMES, getRedisConnectionOptions } from '@/lib/queues'
import { db } from '@/db/client'
import { metricsSnapshots, infrastructureConfigs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProxmoxService } from '@/services/proxmox'
import { decrypt, getEncryptionPassword } from '@/lib/encryption'

interface MetricsJobData {
  userId: string
}

/**
 * Metrics collection worker.
 * Collects CPU, RAM, disk, and network metrics from Proxmox nodes every 30 seconds.
 */
export function createMetricsCollectorWorker(): Worker {
  const worker = new Worker<MetricsJobData>(
    QUEUE_NAMES.METRICS,
    async (job: Job<MetricsJobData>) => {
      const { userId } = job.data

      try {
        // Get user's Proxmox configuration
        const config = await db.query.infrastructureConfigs.findFirst({
          where: eq(infrastructureConfigs.userId, userId),
        })

        if (!config) {
          throw new Error(`Proxmox configuration not found for user ${userId}`)
        }

        // Decrypt Proxmox token
        const password = getEncryptionPassword()
        const token = await decrypt(config.proxmoxToken, password)

        // Create Proxmox service instance
        const proxmox = new ProxmoxService(config.proxmoxHost, config.proxmoxUser, token)

        // Get all nodes
        const nodes = await proxmox.getNodes()

        // Collect metrics for each node
        const metricsPromises = nodes.map(async (node) => {
          try {
            const nodeMetrics = await proxmox.getNodeStatus(node.node)

            // Store metrics in database
            await db.insert(metricsSnapshots).values({
              nodeId: node.node,
              cpuPercent: Math.round(nodeMetrics.cpu.usage),
              ramPercent: Math.round(nodeMetrics.memory.percent),
              diskPercent: Math.round(nodeMetrics.disk.percent),
              networkTx: 0, // Network metrics would need to be tracked separately
              networkRx: 0,
              timestamp: new Date(),
            })

            return { node: node.node, success: true }
          } catch (error) {
            console.error(`Failed to collect metrics for node ${node.node}:`, error)
            return { node: node.node, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
          }
        })

        const results = await Promise.all(metricsPromises)
        const successCount = results.filter((r) => r.success).length

        return {
          success: true,
          nodesProcessed: nodes.length,
          successful: successCount,
          failed: nodes.length - successCount,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        console.error('Metrics collection job failed:', error)
        throw error
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1, // Process one metrics job at a time
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 24 * 3600, // Keep failed jobs for 24 hours
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`Metrics collection job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Metrics collection job ${job?.id} failed:`, err)
  })

  return worker
}
