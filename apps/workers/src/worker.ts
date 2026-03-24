import "@cnet/core/env"
import { initializeWorkers, shutdownWorkers } from "./index"

async function main() {
  console.log("Starting C-Net workers...")
  await initializeWorkers()
  console.log("Workers initialized")
}

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...")
  await shutdownWorkers()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("Shutting down workers...")
  await shutdownWorkers()
  process.exit(0)
})

main().catch((err) => {
  console.error("Worker startup failed:", err.message || err)
  console.error("Workers will retry in 10 seconds...")
  setTimeout(() => main().catch(() => process.exit(1)), 10_000)
})
