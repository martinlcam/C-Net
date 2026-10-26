import { Redis } from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
let client: Redis | null = null

/** Shared ioredis client for plain reads; lazy so importing this never opens a socket. */
export function getRedis(): Redis {
  client ??= new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  return client
}

/** Close the shared client (test teardown, graceful shutdown). */
export async function closeRedis(): Promise<void> {
  if (!client) return
  const c = client
  client = null
  await c.quit().catch(() => {})
}
