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
export function powerLine(ups: OverviewUps | null): { tone: Tone; text: string } {
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
