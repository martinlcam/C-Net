import "@cnet/core/env"
import type { Server } from "node:http"
import { After, AfterAll, BeforeAll, setDefaultTimeout } from "@cucumber/cucumber"
import { createApp } from "../../src/server"
import { type InviteWorld, runtime } from "./world"

setDefaultTimeout(15_000)

// The scenarios need a real database. Fail loudly rather than hang on a missing pool.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run `bun run db:start && bun run db:migrate` first.")
}
process.env.AUTH_SECRET ??= "bdd-only-secret"
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
  await new Promise<void>((resolve) => server?.close(() => resolve()))
})
