import {
  summarizeUps,
  UPS_STATUS_KEY,
  UPS_STATUS_MAX_AGE_MS,
  type UpsRawStatus,
  type UpsSummary,
} from "@cnet/engine"
import { getRedis } from "./redis-client"

/*
 * Latest UPS reading as published by the host's cnet-host-publish agent (see
 * deploy/host/host-publish.ts). Mirrors how the bay inventory is read: a staleness
 * cut-off, null when the agent is not reporting.
 */
export async function getUpsSummary(): Promise<UpsSummary | null> {
  try {
    const raw = await getRedis().get(UPS_STATUS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UpsRawStatus
    if (Date.now() - parsed.ts > UPS_STATUS_MAX_AGE_MS) return null
    return summarizeUps(parsed.vars, parsed.ts)
  } catch {
    return null
  }
}
