import "@cnet/core/env"
import { mkdtempSync } from "node:fs"
import type { Server } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closeQueues } from "@cnet/core"
import { After, AfterAll, BeforeAll, setDefaultTimeout } from "@cucumber/cucumber"
import { createApp } from "../../src/server"
import { type InviteWorld, runtime } from "./world"

setDefaultTimeout(15_000)

// The scenarios need a real database. Fail loudly rather than hang on a missing pool.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run `bun run db:start && bun run db:migrate` first.")
}
process.env.AUTH_SECRET ??= "bdd-only-secret"
// Vault scenarios write real bytes; always use a throwaway tank, never .env's dev tank.
process.env.TANK_MOUNT_PATH = mkdtempSync(join(tmpdir(), "cnet-bdd-tank-"))
process.env.VAULT_ALLOWLIST ??= JSON.stringify([
  { email: "super@bdd.local", role: "super" },
  { email: "storage@bdd.local", role: "storage" },
])

let server: Server | undefined

BeforeAll(async () => {
  const app = createApp()
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const addr = server?.address()
  if (!addr || typeof addr === "string") throw new Error("Could not read server port")
  runtime.baseUrl = `http://127.0.0.1:${addr.port}`
})

After(async function (this: InviteWorld) {
  await this.cleanup()
})

AfterAll(async () => {
  // A finalize enqueues a thumbnail job, which opens a Redis connection that would
  // otherwise keep the process alive; keep-alive sockets likewise block server.close.
  await closeQueues()
  server?.closeAllConnections?.()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
})
