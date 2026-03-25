import "@cnet/core/env"
import { runPreflightChecks } from "./preflight"
import { createApp } from "./server"

const PORT = process.env.API_PORT || 4000

async function main() {
  await runPreflightChecks()

  const app = createApp()

  app.listen(PORT, () => {
    console.log(`C-Net API running on http://localhost:${PORT}`)
  })
}

main().catch(console.error)
