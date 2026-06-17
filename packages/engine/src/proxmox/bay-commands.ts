/*
 * Command channel for the cnet-bayd host agent (Phase 3 actions).
 *
 * The API (in LXC 110) publishes signed commands to Redis `bay:cmd`; the agent
 * (on the host) verifies the HMAC, executes ledctl/hdparm/zpool, and replies on
 * `bay:cmd:reply`. HMAC over a shared secret (CNET_BAYD_CMD_SECRET, present only
 * in the API + agent envs) means a third party with Redis access still can't
 * forge a command. A freshness window guards against replay. See
 * docs/ZFS_BAY_GUI_PLAN.md (Phase 3).
 *
 * This replaces the originally-planned unix socket: a socket bind-mount would
 * require restarting the live container, whereas Redis is already shared.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export const BAY_CMD_CHANNEL = "bay:cmd"
export const BAY_CMD_REPLY_CHANNEL = "bay:cmd:reply"

/** Commands a command is allowed to be older than before it's rejected (replay). */
export const BAY_CMD_MAX_AGE_MS = 30_000

export type BayVerb = "locate" | "spindown" | "zpool"
export type ZpoolAction = "replace" | "offline" | "online" | "scrub"

export interface BayCommand {
  id: string
  ts: number
  verb: BayVerb
  args: Record<string, unknown>
  sig: string
}

export interface BayCommandReply {
  id: string
  ok: boolean
  output?: string
  error?: string
}

function canonical(c: Omit<BayCommand, "sig">): string {
  return `${c.id}.${c.ts}.${c.verb}.${JSON.stringify(c.args)}`
}

export function signCommand(secret: string, c: Omit<BayCommand, "sig">): string {
  return createHmac("sha256", secret).update(canonical(c)).digest("hex")
}

/** Verify HMAC (constant-time) and freshness. */
export function verifyCommand(secret: string, c: BayCommand, now = Date.now()): boolean {
  if (typeof c.sig !== "string" || c.sig.length === 0) return false
  if (typeof c.ts !== "number" || Math.abs(now - c.ts) > BAY_CMD_MAX_AGE_MS) return false
  const expected = signCommand(secret, { id: c.id, ts: c.ts, verb: c.verb, args: c.args })
  const a = Buffer.from(c.sig, "hex")
  const b = Buffer.from(expected, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
