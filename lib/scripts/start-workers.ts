#!/usr/bin/env bun
/**
 * Worker process entry point.
 * Run this separately from the Next.js server to process background jobs.
 *
 * Usage: bun run src/scripts/start-workers.ts
 */

import { initializeWorkers, shutdownWorkers } from "@/workers/index"

async function main() {
  console.log("Starting C-Net workers...")

  try {
    await initializeWorkers()
    console.log("Workers started successfully. Press Ctrl+C to stop.")
  } catch (error) {
    console.error("Failed to start workers:", error)
    process.exit(1)
  }

  // Keep process alive
  process.on("SIGTERM", async () => {
    await shutdownWorkers()
    process.exit(0)
  })

  process.on("SIGINT", async () => {
    await shutdownWorkers()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})
