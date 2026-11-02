import type { OverviewUps } from "./overview-api"

/** Health tone shared by gauges, pool states and the UPS rail. */
export type Tone = "ok" | "warn" | "bad" | "none"

export function usageTone(percent: number): Tone {
  if (percent >= 90) return "bad"
  if (percent >= 70) return "warn"
  return "ok"
}

export function poolTone(state: string): Tone {
  switch (state.toUpperCase()) {
    case "ONLINE":
      return "ok"
    case "DEGRADED":
      return "warn"
    default:
      return "bad"
  }
}

/** Silicon is happy to 75, warm to 85, and throttling territory beyond. */
export function tempTone(c: number): Tone {
  if (c >= 85) return "bad"
  if (c >= 75) return "warn"
  return "ok"
}

/** A fan's speed as 0..1 for the spin rate: duty when known, else rpm against a 2000 rpm fan. */
export function fanSpeed(fan: { rpm: number | null; percent: number | null }): number {
  if (fan.percent !== null) return Math.max(0, Math.min(1, fan.percent / 100))
  if (fan.rpm !== null) return Math.max(0, Math.min(1, fan.rpm / 2000))
  return 0
}

export function fanText(fan: { rpm: number | null; percent: number | null }): string {
  if (fan.rpm !== null) return `${fan.rpm} rpm`
  if (fan.percent !== null) return `${fan.percent}%`
  return "—"
}

/** Bytes per second with a short unit, for rate labels that sit next to a sparkline. */
export function rate(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(bps < 10 * 1024 ? 1 : 0)} KiB/s`
  if (bps < 1024 * 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MiB/s`
  return `${(bps / 1024 / 1024 / 1024).toFixed(2)} GiB/s`
}

export function fmtRuntime(seconds: number | null): string {
  if (seconds === null) return "unknown runtime"
  if (seconds < 60) return "under a minute"
  const minutes = Math.round(seconds / 60)
  if (minutes <= 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** One plain sentence for the power rail, with the tone that colours it. */
export type PowerReading = Pick<
  OverviewUps,
  "onBattery" | "lowBattery" | "chargePercent" | "runtimeSeconds" | "loadWatts"
>

export function powerLine(ups: PowerReading | null): { tone: Tone; text: string } {
  if (!ups) return { tone: "none", text: "No reading from the UPS" }
  const charge =
    ups.chargePercent === null
      ? "charge unknown"
      : ups.chargePercent >= 100
        ? "battery full"
        : `${ups.chargePercent}% charge`
  const watts = ups.loadWatts === null ? "" : ` at ${ups.loadWatts} W`
  if (ups.onBattery) {
    return {
      tone: ups.lowBattery ? "bad" : "warn",
      text: `On battery, ${charge}, ${fmtRuntime(ups.runtimeSeconds)} left${watts}`,
    }
  }
  return {
    tone: "ok",
    text: `On wall power, ${charge}, ${fmtRuntime(ups.runtimeSeconds)} of runtime${watts}`,
  }
}

/** zpool's scan line as a short phrase: "last scrub clean", "resilver in progress", or nothing. */
export function scanSummary(raw: string): string {
  const text = raw.trim()
  if (!text || /^none/i.test(text)) return ""
  const kind = /resilver/i.test(text) ? "resilver" : "scrub"
  if (/in progress/i.test(text)) return `${kind} in progress`
  const errors = text.match(/with (\d+) errors?/i)
  if (errors) {
    const n = Number(errors[1])
    return n === 0 ? `last ${kind} clean` : `last ${kind} found ${n} error${n === 1 ? "" : "s"}`
  }
  return text.length > 40 ? `${text.slice(0, 37)}…` : text
}

/** The state column for a storage row. */
export function storageState(s: {
  active: boolean
  type: string
  pool: { state: string; raid: string; scan: string; errors: string } | null
}): string {
  if (!s.active) return "not mounted"
  if (!s.pool) return "mounted"
  const parts = [s.pool.raid, s.pool.state.toLowerCase()]
  if (s.pool.errors && !/no known data errors/i.test(s.pool.errors)) parts.push("data errors")
  return parts.join(", ")
}
