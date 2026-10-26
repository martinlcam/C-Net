/**
 * UPS state as published by the host-side `cnet-ups-publish` agent: it runs `upsc` every
 * few seconds and stores the raw variables in Redis; the API summarizes them here so the
 * host script stays dumb and the parsing has tests.
 */

/** Redis key the host agent writes `{ ts, vars }` to. */
export const UPS_STATUS_KEY = "ups:status"
/** Older than this and the agent is presumed down; the UI shows "no reading" instead. */
export const UPS_STATUS_MAX_AGE_MS = 60_000

export type UpsRawStatus = { ts: number; vars: Record<string, string> }

export type UpsSummary = {
  ts: number
  model: string | null
  /** NUT status tokens, e.g. ["OL"] on mains, ["OB", "DISCHRG"] on battery, "LB" when low. */
  status: string[]
  onBattery: boolean
  lowBattery: boolean
  chargePercent: number | null
  runtimeSeconds: number | null
  loadPercent: number | null
  /** Load as watts, derived from the UPS's nominal real-power rating when it reports one. */
  loadWatts: number | null
  inputVoltage: number | null
  outputVoltage: number | null
}

/** `upsc` prints one `name: value` per line; values may themselves contain colons. */
export function parseUpsc(text: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const i = line.indexOf(": ")
    if (i <= 0) continue
    vars[line.slice(0, i).trim()] = line.slice(i + 2).trim()
  }
  return vars
}

function num(vars: Record<string, string>, key: string): number | null {
  const v = vars[key]
  if (v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function summarizeUps(vars: Record<string, string>, ts: number): UpsSummary {
  const status = (vars["ups.status"] ?? "").split(/\s+/).filter(Boolean)
  const loadPercent = num(vars, "ups.load")
  const nominal = num(vars, "ups.realpower.nominal")
  return {
    ts,
    model: vars["ups.model"] ?? vars["device.model"] ?? null,
    status,
    onBattery: status.includes("OB"),
    lowBattery: status.includes("LB"),
    chargePercent: num(vars, "battery.charge"),
    runtimeSeconds: num(vars, "battery.runtime"),
    loadPercent,
    loadWatts:
      loadPercent !== null && nominal !== null ? Math.round((loadPercent / 100) * nominal) : null,
    inputVoltage: num(vars, "input.voltage"),
    outputVoltage: num(vars, "output.voltage"),
  }
}
