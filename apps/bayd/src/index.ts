/*
 * cnet-bayd — host-side storage agent for proxbox.
 *
 * Runs on the HOST (not LXC 110): it needs /dev, zpool, hdparm (and later ledctl).
 * It publishes live per-bay telemetry (spin / IO "blink" / resilver) to Redis;
 * apps/realtime fans it out to the browser backplane over WS. Identity + SMART
 * stay on the REST path. See docs/ZFS_BAY_GUI_PLAN.md (Phase 2).
 *
 *   cnet-bayd --PUBLISH bay:status--> Redis --SUB--> apps/realtime --WS--> /bay/live
 *
 * Read-only in Phase 2. Action verbs (locate/spindown/zpool) come in Phase 3 over
 * a unix socket.
 */

import {
  BAY_CMD_CHANNEL,
  BAY_CMD_REPLY_CHANNEL,
  type BayCommand,
  type BayLiveFrame,
  type BayLiveState,
  PROXBOX_BAY_MAP,
  verifyCommand,
} from "@cnet/engine"
import { Redis } from "ioredis"
import { executeCommand, locating } from "./commands"
import { devForSerial, readDiskstats, resilverStatus, spinState } from "./probes"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const CHANNEL = process.env.BAY_REDIS_CHANNEL || "bay:status"
const CMD_SECRET = process.env.CNET_BAYD_CMD_SECRET || ""
const IO_TICK_MS = Number(process.env.BAYD_IO_TICK_MS || 1000)
const SLOW_TICK_MS = Number(process.env.BAYD_SLOW_TICK_MS || 10000)

// Occupied bays we can probe (have an expected serial).
const SERIALS = PROXBOX_BAY_MAP.map((b) => b.expectedSerial).filter((s): s is string => Boolean(s))

const publisher = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false })
publisher.on("error", (e) => console.error("[bayd] redis error:", e.message))
publisher.on("ready", () => console.log("[bayd] redis ready"))

// Dedicated subscriber for the command channel (ioredis: a subscribed connection
// can't issue normal commands, so replies go out on `publisher`).
const subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false })
subscriber.on("error", (e) => console.error("[bayd] cmd sub error:", e.message))
subscriber.subscribe(BAY_CMD_CHANNEL, (err) => {
  if (err) console.error("[bayd] cmd subscribe failed:", err.message)
  else console.log(`[bayd] listening for commands on ${BAY_CMD_CHANNEL}`)
})
subscriber.on("message", (_ch, raw) => {
  let cmd: BayCommand
  try {
    cmd = JSON.parse(raw)
  } catch {
    return
  }
  if (!CMD_SECRET) {
    console.error("[bayd] command received but CNET_BAYD_CMD_SECRET unset — ignoring")
    return
  }
  if (!verifyCommand(CMD_SECRET, cmd)) {
    console.error(`[bayd] rejected command ${cmd?.id} (bad signature/stale)`)
    return
  }
  const reply = executeCommand(cmd)
  console.log(`[bayd] cmd ${cmd.verb} ${reply.ok ? "ok" : `ERR: ${reply.error}`}`)
  publisher.publish(BAY_CMD_REPLY_CHANNEL, JSON.stringify(reply)).catch(() => {})
})

// serial -> devName ("sda"); refreshed on the slow tick (drives can re-letter).
let devBySerial = new Map<string, string>()
// devName -> last cumulative IO count, for delta detection.
let lastIo = new Map<string, number>()
// serial -> latest slow-tick state.
const spinBySerial = new Map<string, BayLiveState["spin"]>()
let resilver: BayLiveFrame["resilver"]

function refreshDevMap(): void {
  const next = new Map<string, string>()
  for (const serial of SERIALS) {
    const dev = devForSerial(serial)
    if (dev) next.set(serial, dev.replace("/dev/", ""))
  }
  devBySerial = next
}

function slowTick(): void {
  refreshDevMap()
  for (const serial of SERIALS) {
    const dev = devBySerial.get(serial)
    spinBySerial.set(serial, dev ? spinState(`/dev/${dev}`) : "unknown")
  }
  resilver = resilverStatus()
}

function ioTick(): void {
  const now = readDiskstats()
  const active = new Map<string, boolean>()
  for (const [dev, count] of now) {
    const prev = lastIo.get(dev)
    active.set(dev, prev !== undefined && count > prev)
  }
  lastIo = now

  const bays: BayLiveState[] = SERIALS.map((serial) => {
    const dev = devBySerial.get(serial)
    return {
      serial,
      spin: spinBySerial.get(serial) ?? "unknown",
      ioActive: dev ? (active.get(dev) ?? false) : false,
      locate: locating.has(serial),
    }
  })

  const frame: BayLiveFrame = { t: "bay", ts: Date.now(), bays, resilver }
  publisher.publish(CHANNEL, JSON.stringify(frame)).catch((e) => {
    console.error("[bayd] publish failed:", (e as Error).message)
  })
}

console.log(`[bayd] starting — channel=${CHANNEL} bays=${SERIALS.length}`)
slowTick()
ioTick()
const ioTimer = setInterval(ioTick, IO_TICK_MS)
const slowTimer = setInterval(slowTick, SLOW_TICK_MS)

async function shutdown(sig: string): Promise<void> {
  console.log(`[bayd] ${sig} — shutting down`)
  clearInterval(ioTimer)
  clearInterval(slowTimer)
  await Promise.allSettled([publisher.quit(), subscriber.quit()])
  process.exit(0)
}
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
