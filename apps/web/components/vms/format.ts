/** Binary-prefix bytes, matching how PVE reports guest memory and disk. */
export function bytes(value: number | undefined): string {
  if (!value || value <= 0) return "—"
  const units = ["B", "KiB", "MiB", "GiB", "TiB"]
  let n = value
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

/** Coarse uptime — the dashboard never needs seconds, but "0h" reads as broken. */
export function uptime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function percent(used: number | undefined, total: number | undefined): number {
  if (!used || !total || total <= 0) return 0
  return Math.min((used / total) * 100, 100)
}
