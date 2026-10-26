import {
  summarizeUps,
  UPS_STATUS_KEY,
  UPS_STATUS_MAX_AGE_MS,
  type UpsRawStatus,
  type UpsSummary,
} from "@cnet/engine"
import { Redis } from "ioredis"

/*
 * Latest UPS reading as published by the host's cnet-ups-publish agent (see
 * deploy/host/ups-publish.ts). Mirrors how the bay inventory is read: one shared
 * Redis client, a staleness cut-off, null when the agent is not reporting.
 */

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
let client: Redis | null = null

export async function getUpsSummary(): Promise<UpsSummary | null> {
  client ??= new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  try {
    const raw = await client.get(UPS_STATUS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UpsRawStatus
    if (Date.now() - parsed.ts > UPS_STATUS_MAX_AGE_MS) return null
    return summarizeUps(parsed.vars, parsed.ts)
  } catch {
    return null
  }
}
