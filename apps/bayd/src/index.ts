/*
 * cnet-bayd — host-side storage agent for proxbox.
 *
 * Runs on the HOST (not LXC 110): it needs /dev, zpool, smartctl (and ledctl/
 * hdparm for actions). It resolves each physical bay (by-path port) to whatever
 * drive is currently in it, publishes the inventory (port→drive) plus live
 * telemetry (spin / IO "blink" / resilver) to Redis, and executes signed action
 * commands. See docs/ZFS_BAY_GUI_PLAN.md.
 *
 *   cnet-bayd --SET bay:inventory / PUBLISH bay:status--> Redis --> API + /bay/live
 *   API --PUBLISH bay:cmd (HMAC)--> cnet-bayd --PUBLISH bay:cmd:reply-->
 */

import {
  BAY_CMD_CHANNEL,
  BAY_CMD_REPLY_CHANNEL,
  BAY_INVENTORY_KEY,
  type BayCommand,
  type BayInventory,
  type BayInventoryEntry,
  type BayLiveFrame,
  type BayLiveState,
  PROXBOX_BAY_MAP,
  type SpinState,
  verifyCommand,
} from "@cnet/engine"
import { Redis } from "ioredis"
import { executeCommand, locating } from "./commands"
import { devToSerialMap, readDiskstats, resilverStatus, resolveByPath, spinState } from "./probes"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const CHANNEL = process.env.BAY_REDIS_CHANNEL || "bay:status"
const CMD_SECRET = process.env.CNET_BAYD_CMD_SECRET || ""
const IO_TICK_MS = Number(process.env.BAYD_IO_TICK_MS || 1000)
const SLOW_TICK_MS = Number(process.env.BAYD_SLOW_TICK_MS || 10000)

const publisher = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false })
publisher.on("error", (e) => console.error("[bayd] redis error:", e.message))
publisher.on("ready", () => console.log("[bayd] redis ready"))

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

// Current port→drive inventory (rebuilt each slow tick).
let inventory: BayInventoryEntry[] = []
let spinByDev = new Map<string, SpinState>()
let lastIo = new Map<string, number>()
let resilver: BayLiveFrame["resilver"]

function slowTick(): void {
  const dts = devToSerialMap()
  inventory = PROXBOX_BAY_MAP.map((slot) => {
    const r = resolveByPath(slot.byPath)
    return {
      bayIndex: slot.bayIndex,
      byPath: slot.byPath,
      present: Boolean(r),
      serial: r ? dts.get(r.dev) : undefined,
      devPath: r?.devPath,
    }
  })

  const spin = new Map<string, SpinState>()
  for (const e of inventory) {
    if (e.devPath) spin.set(e.devPath.replace("/dev/", ""), spinState(e.devPath))
  }
  spinByDev = spin
  resilver = resilverStatus()

  const payload: BayInventory = { ts: Date.now(), bays: inventory }
  publisher.set(BAY_INVENTORY_KEY, JSON.stringify(payload)).catch((e) => {
    console.error("[bayd] inventory publish failed:", (e as Error).message)
  })
}

function ioTick(): void {
  const now = readDiskstats()
  const active = new Map<string, boolean>()
  for (const [dev, count] of now) {
    const prev = lastIo.get(dev)
    active.set(dev, prev !== undefined && count > prev)
  }
  lastIo = now

  const bays: BayLiveState[] = []
  for (const e of inventory) {
    if (!e.present || !e.serial) continue
    const dev = e.devPath ? e.devPath.replace("/dev/", "") : ""
    bays.push({
      serial: e.serial,
      spin: spinByDev.get(dev) ?? "unknown",
      ioActive: dev ? (active.get(dev) ?? false) : false,
      locate: locating.has(e.serial),
    })
  }

  const frame: BayLiveFrame = { t: "bay", ts: Date.now(), bays, resilver }
  publisher.publish(CHANNEL, JSON.stringify(frame)).catch((e) => {
    console.error("[bayd] publish failed:", (e as Error).message)
  })
}

console.log(`[bayd] starting — bays=${PROXBOX_BAY_MAP.length} channel=${CHANNEL}`)
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
