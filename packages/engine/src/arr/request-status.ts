// Turns Radarr/Sonarr state into something a person can read: where a request is in its
// life (waiting for the release, being searched for, downloading, stuck, importing, failed)
// and why. Pure functions; the controllers feed them raw API records.

export type RequestPhase =
  | "waiting"
  | "searching"
  | "queued"
  | "downloading"
  | "paused"
  | "stalled"
  | "importing"
  | "failed"

export type RequestStatus = {
  id: number
  title: string
  phase: RequestPhase
  /** One line: what is happening. */
  label: string
  /** One line: why, or what comes next. Null when the label says it all. */
  detail: string | null
  /** 0..100 while downloading, else null. */
  progress: number | null
  etaSeconds: number | null
}

export type HealthNotice = { level: "warning" | "error"; message: string }

/** The queue record shape shared by Radarr and Sonarr (`/api/v3/queue`). */
export type ArrQueueRecord = {
  title: string
  status?: string
  trackedDownloadStatus?: string
  trackedDownloadState?: string
  statusMessages?: Array<{ title?: string; messages?: string[] }>
  errorMessage?: string
  size?: number
  sizeleft?: number
  /** "hh:mm:ss" or "d.hh:mm:ss" as the clients report it. */
  timeleft?: string
  indexer?: string
  downloadClient?: string
}

export type ArrMovieRecord = {
  id: number
  title: string
  year?: number
  hasFile: boolean
  monitored: boolean
  isAvailable?: boolean
  /** announced | inCinemas | released | deleted | tba */
  status?: string
  minimumAvailability?: string
  inCinemas?: string
  digitalRelease?: string
  physicalRelease?: string
  added?: string
  lastSearchTime?: string
}

export type ArrMissingEpisode = {
  seriesId: number
  seasonNumber: number
  episodeNumber: number
  airDateUtc?: string
  series?: { title?: string }
}

export type ArrHealthRecord = { type?: string; source?: string; message?: string }

const DAY = 86_400_000

export function parseTimeleft(raw: string | undefined): number | null {
  if (!raw) return null
  const m = /^(?:(\d+)\.)?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(raw)
  if (!m) return null
  const [, d, h, min, s] = m
  return Number(d ?? 0) * 86_400 + Number(h) * 3600 + Number(min) * 60 + Number(s)
}

function progressOf(size?: number, left?: number): number | null {
  if (!size || size <= 0) return null
  return Math.max(0, Math.min(100, Math.round(((size - (left ?? 0)) / size) * 100)))
}

function firstMessage(r: ArrQueueRecord): string | null {
  for (const m of r.statusMessages ?? []) {
    const text = m.messages?.find((s) => s?.trim())
    if (text) return text.trim()
    if (m.title?.trim()) return m.title.trim()
  }
  return r.errorMessage?.trim() || null
}

function day(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function ago(iso: string | undefined, now: number): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const mins = Math.round((now - t) / 60_000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

/** A download the client is tracking. */
export function describeQueueItem(id: number, r: ArrQueueRecord): RequestStatus {
  const base = { id, title: r.title, progress: null, etaSeconds: null }
  const reason = firstMessage(r)
  const state = r.trackedDownloadState ?? ""
  const status = r.status ?? ""
  const where = r.downloadClient ? ` in ${r.downloadClient}` : ""

  if (state === "importBlocked" || state === "importFailed") {
    return { ...base, phase: "failed", label: "Downloaded but not imported", detail: reason }
  }
  if (state === "failed" || state === "failedPending" || status === "failed") {
    return { ...base, phase: "failed", label: "Download failed", detail: reason }
  }
  if (r.trackedDownloadStatus === "error") {
    return { ...base, phase: "failed", label: "Download failed", detail: reason }
  }
  if (state === "importPending" || state === "importing" || status === "completed") {
    return {
      ...base,
      phase: "importing",
      label: "Downloaded, adding to the library",
      detail: reason,
      progress: 100,
    }
  }
  if (status === "paused") {
    return { ...base, phase: "paused", label: `Paused${where}`, detail: reason }
  }
  if (status === "queued" || status === "delay") {
    return {
      ...base,
      phase: "queued",
      label: `Waiting in line${where}`,
      detail: reason ?? (r.indexer ? `Found on ${r.indexer}` : null),
    }
  }
  const progress = progressOf(r.size, r.sizeleft)
  const etaSeconds = parseTimeleft(r.timeleft)
  if (r.trackedDownloadStatus === "warning" || status === "warning") {
    return {
      ...base,
      phase: "stalled",
      label: progress !== null ? `Stuck at ${progress}%` : "Stuck",
      detail: reason,
      progress,
      etaSeconds: null,
    }
  }
  return {
    ...base,
    phase: "downloading",
    label: progress !== null ? `Downloading, ${progress}%` : "Downloading",
    detail: r.indexer ? `From ${r.indexer}${where}` : null,
    progress,
    etaSeconds,
  }
}

/** A requested movie that has no file and is not in the download queue. */
export function describeMissingMovie(m: ArrMovieRecord, now = Date.now()): RequestStatus {
  const base = { id: m.id, title: m.year ? `${m.title} (${m.year})` : m.title }
  const idle = { progress: null, etaSeconds: null }
  const home = m.digitalRelease ?? m.physicalRelease
  const homeTime = home ? new Date(home).getTime() : Number.NaN

  if (m.isAvailable === false || m.status === "announced" || m.status === "inCinemas") {
    let detail: string
    if (Number.isFinite(homeTime) && homeTime > now) {
      detail = `Home release expected ${day(home)}.`
    } else if (
      m.status === "inCinemas" ||
      (m.inCinemas && new Date(m.inCinemas).getTime() <= now)
    ) {
      detail = `In cinemas since ${day(m.inCinemas) ?? "recently"}; no home release date announced yet.`
    } else if (m.inCinemas && new Date(m.inCinemas).getTime() > now) {
      detail = `In cinemas from ${day(m.inCinemas)}; home release later.`
    } else {
      detail = "Not released yet."
    }
    return {
      ...base,
      ...idle,
      phase: "waiting",
      label: "Waiting for the home release",
      detail: `${detail} It will be searched for automatically once it's out.`,
    }
  }

  const since = Number.isFinite(homeTime) && homeTime <= now ? `Out since ${day(home)}. ` : ""
  const looked = ago(m.lastSearchTime, now)
  const recent = now - new Date(m.added ?? 0).getTime() < DAY
  return {
    ...base,
    ...idle,
    phase: "searching",
    label: "Searching for a copy",
    detail: `${since}Nothing on the indexers yet${looked ? ` (last looked ${looked})` : ""}.${
      recent ? "" : " Rare titles can take a while to appear."
    }`,
  }
}

/** Missing monitored episodes grouped per series. */
export function describeMissingEpisodes(
  episodes: ArrMissingEpisode[],
  now = Date.now()
): RequestStatus[] {
  const bySeries = new Map<number, ArrMissingEpisode[]>()
  for (const e of episodes) {
    const list = bySeries.get(e.seriesId) ?? []
    list.push(e)
    bySeries.set(e.seriesId, list)
  }
  const out: RequestStatus[] = []
  for (const [seriesId, eps] of bySeries) {
    const aired = eps.filter((e) => e.airDateUtc && new Date(e.airDateUtc).getTime() <= now)
    const upcoming = eps
      .filter((e) => e.airDateUtc && new Date(e.airDateUtc).getTime() > now)
      .sort((a, b) => String(a.airDateUtc).localeCompare(String(b.airDateUtc)))
    const title = eps[0]?.series?.title ?? `Series ${seriesId}`
    const idle = { id: seriesId, title, progress: null, etaSeconds: null }
    if (aired.length === 0 && upcoming.length > 0) {
      out.push({
        ...idle,
        phase: "waiting",
        label: `${upcoming.length} episode${upcoming.length === 1 ? "" : "s"} not aired yet`,
        detail: `Next airs ${day(upcoming[0].airDateUtc)}.`,
      })
      continue
    }
    out.push({
      ...idle,
      phase: "searching",
      label: `Searching for ${aired.length} episode${aired.length === 1 ? "" : "s"}`,
      detail:
        upcoming.length > 0
          ? `${upcoming.length} more still to air; next ${day(upcoming[0].airDateUtc)}.`
          : "Nothing on the indexers for them yet.",
    })
  }
  return out
}

/** Health problems worth showing to the person waiting; update nags are not. */
export function describeHealth(records: ArrHealthRecord[]): HealthNotice[] {
  const out: HealthNotice[] = []
  for (const r of records) {
    if (!r.message || r.source === "UpdateCheck") continue
    const level = r.type === "error" ? "error" : r.type === "warning" ? "warning" : null
    if (!level) continue
    out.push({ level, message: r.message })
  }
  return out
}
