import type { JellyfinItem } from "../jellyfin/types"
import type { SonarrSeries } from "../sonarr/types"

/*
 * Whether a series is still releasing and when the next episode lands. Sonarr is the
 * authority when it tracks the show (it knows the next air time); Jellyfin's metadata
 * (Status, AirDays) is the fallback for shows Sonarr does not have.
 */

export type AiringStatus = "continuing" | "ended" | "upcoming" | "unknown"

export interface AiringInfo {
  status: AiringStatus
  /** ISO time of the next episode, when Sonarr knows it. */
  nextAiring: string | null
  previousAiring: string | null
  /** Weekday name ("Tuesday") the show airs on, from the next air time or Jellyfin's AirDays. */
  airDay: string | null
  network: string | null
  source: "sonarr" | "jellyfin"
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Sonarr's entry for a Jellyfin series: by TVDB id, else by title and year. */
export function matchSonarrSeries(
  item: JellyfinItem,
  list: SonarrSeries[]
): SonarrSeries | undefined {
  const tvdb = Number(item.ProviderIds?.Tvdb)
  if (Number.isInteger(tvdb) && tvdb > 0) {
    const hit = list.find((s) => s.tvdbId === tvdb)
    if (hit) return hit
  }
  const title = normalizeTitle(item.Name)
  return list.find(
    (s) =>
      normalizeTitle(s.title) === title &&
      (item.ProductionYear === undefined || s.year === item.ProductionYear)
  )
}

function statusFrom(raw: string | undefined): AiringStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "continuing":
      return "continuing"
    case "ended":
      return "ended"
    case "upcoming":
      return "upcoming"
    default:
      return "unknown"
  }
}

export function airingInfo(
  item: JellyfinItem,
  sonarr: SonarrSeries | undefined
): AiringInfo | null {
  if (sonarr) {
    const status = statusFrom(sonarr.status)
    const next = sonarr.nextAiring ?? null
    const airDay = next ? WEEKDAYS[new Date(next).getUTCDay()] : (item.AirDays?.[0] ?? null)
    if (status === "unknown" && !next) return null
    return {
      status,
      nextAiring: next,
      previousAiring: sonarr.previousAiring ?? null,
      airDay,
      network: sonarr.network ?? null,
      source: "sonarr",
    }
  }
  const status = statusFrom(item.Status)
  if (status === "unknown") return null
  return {
    status,
    nextAiring: null,
    previousAiring: null,
    airDay: item.AirDays?.[0] ?? null,
    network: null,
    source: "jellyfin",
  }
}
