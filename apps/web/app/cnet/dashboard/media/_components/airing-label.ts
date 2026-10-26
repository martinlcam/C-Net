import type { Airing } from "@/lib/media-api"

const DAY = 86_400_000
/** With no next date, a last episode older than this reads as a break between seasons. */
const HIATUS_DAYS = 45
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** Whole days between two instants, by calendar day in UTC. */
function daysUntil(iso: string, now: number): number {
  const a = Math.floor(now / DAY)
  const b = Math.floor(Date.parse(iso) / DAY)
  return b - a
}

/**
 * The chip over a series poster, or null when the row should stay quiet. Only shows that
 * are still releasing, or have not started, earn one.
 */
export function airingChip(airing: Airing | null | undefined, now: number): string | null {
  if (!airing) return null
  if (airing.status === "upcoming") return "Upcoming"
  if (airing.status !== "continuing") return null
  if (airing.nextAiring) {
    const d = daysUntil(airing.nextAiring, now)
    if (d <= 0) return "Next ep today"
    if (d === 1) return "Next ep tomorrow"
    const when = new Date(airing.nextAiring)
    if (d < 7) return `Next ep ${SHORT_DAYS[when.getUTCDay()]}`
    return `Next ep ${when.getUTCDate()} ${MONTHS[when.getUTCMonth()].slice(0, 3)}`
  }
  if (onHiatus(airing, now)) return null
  if (airing.airDay) return `Airs ${airing.airDay}s`
  return "Airing"
}

/** Continuing per the provider, but nothing scheduled and the last episode well in the past. */
function onHiatus(airing: Airing, now: number): boolean {
  if (airing.nextAiring || !airing.previousAiring) return false
  return daysUntil(airing.previousAiring, now) < -HIATUS_DAYS
}

/** One sentence for the series header. */
export function airingLine(airing: Airing | null | undefined, now: number): string | null {
  if (!airing) return null
  const on = airing.network ? ` on ${airing.network}` : ""
  if (airing.status === "ended")
    return `Ended${airing.network ? `, aired on ${airing.network}` : ""}`
  if (airing.status === "upcoming") {
    return airing.nextAiring ? `Starts ${longDate(airing.nextAiring)}${on}` : `Not started yet${on}`
  }
  if (airing.status === "continuing") {
    if (airing.nextAiring) {
      const d = daysUntil(airing.nextAiring, now)
      const when = d <= 0 ? "today" : longDate(airing.nextAiring)
      return `Continuing${on}, next episode ${when}`
    }
    if (onHiatus(airing, now) && airing.previousAiring) {
      const last = new Date(airing.previousAiring)
      return `Between seasons${on}, last episode ${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]}`
    }
    if (airing.airDay) return `Continuing${on}, airs ${airing.airDay}s`
    return `Continuing${on}`
  }
  return null
}

function longDate(iso: string): string {
  const d = new Date(iso)
  return `${LONG_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
