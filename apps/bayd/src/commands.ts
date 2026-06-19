import { spawnSync } from "node:child_process"
import { type BayCommand, type BayCommandReply, PROXBOX_BAY_MAP } from "@cnet/engine"
import { byPathForDev, devForSerial } from "./probes"

/** Serials whose locate LED is currently being driven (reflected in live frames). */
export const locating = new Set<string>()

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 30_000 })
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim()
  return { ok: r.status === 0, out }
}

/** Which pool a serial currently belongs to (from `zpool status`), or undefined. */
function poolForSerial(serial: string): string | undefined {
  const r = spawnSync("zpool", ["status"], { encoding: "utf8", timeout: 8000 })
  let current = ""
  for (const raw of (r.stdout ?? "").split("\n")) {
    const line = raw.trim()
    const m = line.match(/^pool:\s+(\S+)/)
    if (m) {
      current = m[1]
      continue
    }
    if (line.includes(serial)) return current
  }
  return undefined
}

function bySerialDev(serial: string): string | undefined {
  return devForSerial(serial)
}

function locate(serial: string, on: boolean): string | { output: string } {
  const dev = bySerialDev(serial)
  if (!dev) return `No device for serial ${serial}`
  // ledCapable is a property of the physical port (HBA), resolved via by-path.
  const byPath = byPathForDev(dev.replace("/dev/", ""))
  const slot = byPath ? PROXBOX_BAY_MAP.find((s) => s.byPath === byPath) : undefined
  if (!slot?.ledCapable) return "Locate LED not available on this bay (AHCI/unknown)"
  const r = run("ledctl", [on ? `locate=${dev}` : `locate_off=${dev}`])
  if (!r.ok) return r.out || "ledctl failed"
  if (on) locating.add(serial)
  else locating.delete(serial)
  return { output: `locate ${on ? "on" : "off"} ${serial} (${dev})` }
}

function spindown(serial: string): string | { output: string } {
  // Safety: never spin down an active raidz member (tank_main); cold_tank/idle only.
  const pool = poolForSerial(serial)
  if (pool === "tank_main") return "Refusing: drive is an active tank_main (raidz3) member"
  const dev = bySerialDev(serial)
  if (!dev) return `No device for serial ${serial}`
  const r = run("hdparm", ["-y", dev])
  if (!r.ok) return r.out || "hdparm failed"
  return { output: `spindown ${serial} (${dev})` }
}

function zpool(args: Record<string, unknown>): string | { output: string } {
  const action = String(args.action || "")
  const pool = String(args.pool || "")
  if (!pool) return "Missing pool"
  // target/newTarget are zpool vdev identifiers (by-id names) supplied by the API.
  switch (action) {
    case "scrub":
      return finish(run("zpool", ["scrub", pool]), `scrub started on ${pool}`)
    case "offline":
      return finish(run("zpool", ["offline", pool, String(args.target)]), `offlined ${args.target}`)
    case "online":
      return finish(run("zpool", ["online", pool, String(args.target)]), `onlined ${args.target}`)
    case "replace":
      return finish(
        run("zpool", ["replace", pool, String(args.target), String(args.newTarget)]),
        `replacing ${args.target} -> ${args.newTarget}`
      )
    default:
      return `Unknown zpool action: ${action}`
  }
}

function finish(r: { ok: boolean; out: string }, okMsg: string): string | { output: string } {
  return r.ok ? { output: r.out || okMsg } : r.out || "zpool command failed"
}

/** Execute a verified command and produce a reply. */
export function executeCommand(cmd: BayCommand): BayCommandReply {
  try {
    let res: string | { output: string }
    if (cmd.verb === "locate") {
      res = locate(String(cmd.args.serial), Boolean(cmd.args.on))
    } else if (cmd.verb === "spindown") {
      res = spindown(String(cmd.args.serial))
    } else if (cmd.verb === "zpool") {
      res = zpool(cmd.args)
    } else {
      res = `Unknown verb: ${cmd.verb}`
    }
    if (typeof res === "string") return { id: cmd.id, ok: false, error: res }
    return { id: cmd.id, ok: true, output: res.output }
  } catch (e) {
    return { id: cmd.id, ok: false, error: e instanceof Error ? e.message : "command failed" }
  }
}
