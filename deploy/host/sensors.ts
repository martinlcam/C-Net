/*
 * Parsers for what the host agent reads beyond pvesh: hwmon temperatures and fans, PSI
 * pressure, ZFS per-dataset IO counters and CPU clock. Pure functions over file text so
 * they can be tested off the box; host-publish.ts does the reading.
 */

export type TempReading = { label: string; c: number }
/** A fan with whichever of tachometer (rpm) and duty (percent) the driver exposes. */
export type FanReading = { label: string; rpm: number | null; percent: number | null }
export type ZfsCounters = {
  pool: string
  reads: number
  writes: number
  nread: number
  nwritten: number
}

const num = (raw: string | null | undefined): number | null => {
  if (raw === null || raw === undefined) return null
  const n = Number(raw.trim())
  return Number.isFinite(n) ? n : null
}

/** hwmon reports millidegrees; one decimal is all a dashboard can use. */
export function milliToC(raw: string | null): number | null {
  const n = num(raw)
  return n === null ? null : Math.round(n / 100) / 10
}

/** hwmon pwm files hold a duty of 0..255. */
export function pwmToPercent(raw: string | null): number | null {
  const n = num(raw)
  return n === null ? null : Math.round(Math.max(0, Math.min(255, n)) / 2.55)
}

/**
 * Which hwmon inputs to publish, as "<driver>:<input>=<label>" pairs. The default fits the
 * proxbox board (k10temp for the CPU, nouveau for the GPU, gigabyte_wmi for the EC sensors
 * in the order it87 documents for the X570 Aorus: 2 chipset, 5 VRM). Override with
 * HOST_SENSOR_LABELS when the board changes.
 */
export const DEFAULT_SENSOR_LABELS =
  "k10temp:temp1=CPU,nouveau:temp1=GPU,gigabyte_wmi:temp2=Chipset,gigabyte_wmi:temp5=VRM,nouveau:pwm1=GPU fan"

export function parseSensorLabels(spec: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of spec.split(",")) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    const label = part.slice(eq + 1).trim()
    if (key && label) map.set(key, label)
  }
  return map
}

/** "some avg10=0.12 avg60=0.10 ..." → 0.12; PSI "some" is the share of time anything stalled. */
export function parsePsiSome(text: string | null): number | null {
  const m = text?.match(/^some avg10=([\d.]+)/m)
  return m ? Number(m[1]) : null
}

/** Sum reads/writes/nread/nwritten across the objset-* kstats of one pool. */
export function sumObjsetCounters(pool: string, texts: string[]): ZfsCounters {
  const out: ZfsCounters = { pool, reads: 0, writes: 0, nread: 0, nwritten: 0 }
  for (const text of texts) {
    for (const key of ["reads", "writes", "nread", "nwritten"] as const) {
      const m = text.match(new RegExp(`^${key}\\s+\\d+\\s+(\\d+)`, "m"))
      if (m) out[key] += Number(m[1])
    }
  }
  return out
}

/** Mean of cpufreq scaling_cur_freq values (kHz) in MHz, or null when none are readable. */
export function meanKhzToMhz(values: Array<string | null>): number | null {
  const ns = values.map(num).filter((n): n is number => n !== null && n > 0)
  if (ns.length === 0) return null
  return Math.round(ns.reduce((a, b) => a + b, 0) / ns.length / 1000)
}
