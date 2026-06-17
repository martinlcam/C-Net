import { randomUUID } from "node:crypto"
import {
  BAY_CMD_CHANNEL,
  BAY_CMD_REPLY_CHANNEL,
  type BayCommand,
  type BayCommandReply,
  type BayVerb,
  signCommand,
} from "@cnet/engine"
import { Redis } from "ioredis"

/*
 * Client for the cnet-bayd command channel. Publishes HMAC-signed commands to
 * Redis and awaits the agent's reply (correlated by id). One shared publisher +
 * one shared reply-subscriber for the process. See packages/engine bay-commands.
 */

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const secret = () => process.env.CNET_BAYD_CMD_SECRET || ""

let pub: Redis | null = null
let sub: Redis | null = null
const pending = new Map<string, (r: BayCommandReply) => void>()

function ensure(): void {
  if (pub) return
  pub = new Redis(REDIS_URL)
  sub = new Redis(REDIS_URL)
  sub.subscribe(BAY_CMD_REPLY_CHANNEL)
  sub.on("message", (_ch, raw) => {
    try {
      const r = JSON.parse(raw) as BayCommandReply
      const cb = pending.get(r.id)
      if (cb) {
        pending.delete(r.id)
        cb(r)
      }
    } catch {
      /* ignore malformed reply */
    }
  })
}

export class BayCommandError extends Error {}

export async function sendBayCommand(
  verb: BayVerb,
  args: Record<string, unknown>,
  timeoutMs = 25_000
): Promise<BayCommandReply> {
  const s = secret()
  if (!s) throw new BayCommandError("CNET_BAYD_CMD_SECRET not set — cannot issue commands")
  ensure()
  const base = { id: randomUUID(), ts: Date.now(), verb, args }
  const cmd: BayCommand = { ...base, sig: signCommand(s, base) }

  return new Promise<BayCommandReply>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(cmd.id)
      reject(new BayCommandError("agent did not reply (is cnet-bayd running on the host?)"))
    }, timeoutMs)
    pending.set(cmd.id, (r) => {
      clearTimeout(timer)
      resolve(r)
    })
    // biome-ignore lint/style/noNonNullAssertion: ensure() set pub
    pub!.publish(BAY_CMD_CHANNEL, JSON.stringify(cmd)).catch((e) => {
      clearTimeout(timer)
      pending.delete(cmd.id)
      reject(e)
    })
  })
}
