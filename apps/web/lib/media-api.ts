const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export type Movie = {
  id: string
  title: string
  year?: number
  overview?: string
  genres: string[]
  runtimeMinutes?: number
  communityRating?: number
  officialRating?: string
  posterUrl: string | null
  backdropUrl: string | null
  streamUrl: string
  hlsUrl: string
  resumePositionTicks: number
  playedPercentage?: number
  played: boolean
}

export type Airing = {
  status: "continuing" | "ended" | "upcoming" | "unknown"
  nextAiring: string | null
  previousAiring: string | null
  airDay: string | null
  network: string | null
  source: "sonarr" | "jellyfin"
}

export type Series = {
  id: string
  title: string
  year?: number
  overview?: string
  genres: string[]
  communityRating?: number
  officialRating?: string
  posterUrl: string | null
  backdropUrl: string | null
  seasonCount?: number
  airing: Airing | null
}

export type Season = {
  id: string
  name: string
  seasonNumber: number
  posterUrl: string | null
}

export type Episode = {
  id: string
  title: string
  overview?: string
  seriesName?: string
  seriesId?: string
  seasonId?: string
  seasonNumber?: number
  episodeNumber?: number
  runtimeMinutes?: number
  posterUrl: string | null
  streamUrl: string
  hlsUrl: string
  resumePositionTicks: number
  playedPercentage?: number
  played: boolean
}

/** Anything the player can play (movie or episode). */
export type Playable = {
  id: string
  title: string
  year?: number
  streamUrl: string
  hlsUrl: string
  resumePositionTicks: number
  /** TV-only labelling for the player's "Up next" card. */
  seriesName?: string
  /** TV-only: parent series/season ids, for the in-player episode selector. */
  seriesId?: string
  seasonId?: string
  seasonNumber?: number
  episodeNumber?: number
}

export type AudioTrack = { index: number; language: string | null; label: string }
export type SubtitleTrack = {
  index: number
  language: string | null
  label: string
  forced: boolean
}
/** Scrub-preview thumbnail grid — see TrickplayDTO on the API side. */
export type Trickplay = {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  thumbnailCount: number
  intervalSeconds: number
}
export type ItemTracks = {
  /** Signed HLS URL minted at request time — see ItemTracksDTO on the API side. */
  hlsUrl: string
  audio: AudioTrack[]
  subtitles: SubtitleTrack[]
  preferredAudioIndex: number | null
  creditsStartSeconds: number | null
  introStartSeconds: number | null
  introEndSeconds: number | null
  /** Null until Jellyfin has generated trickplay tiles for the item. */
  trickplay: Trickplay | null
  /** False when the video itself must be transcoded (HEVC/10-bit) — see the API DTO. */
  videoDirect: boolean
  videoCodec: string | null
}

export type DiscoverResult = {
  tmdbId: number
  title: string
  year: number
  overview?: string
  posterUrl?: string
  inLibrary: boolean
  hasFile: boolean
}

export type DiscoverTv = {
  tvdbId: number
  title: string
  year: number
  overview?: string
  posterUrl?: string
  network?: string
  inLibrary: boolean
}

export type RequestPhase =
  | "waiting"
  | "searching"
  | "queued"
  | "downloading"
  | "paused"
  | "stalled"
  | "importing"
  | "failed"

/** One requested title and where it is, in words (see the API's RequestStatusDTO). */
export type RequestStatus = {
  id: number
  title: string
  phase: RequestPhase
  label: string
  detail: string | null
  progress: number | null
  etaSeconds: number | null
}

export type HealthNotice = { level: "warning" | "error"; message: string }

export type RequestsStatus = { items: RequestStatus[]; health: HealthNotice[] }

export const TICKS_PER_SECOND = 10_000_000

/** Absolute URL for a signed media path (poster/backdrop/stream) returned by the API. */
export function mediaUrl(path: string): string {
  return `${API_BASE}${path}`
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(body.message || "Request failed")
  }
  return res.json() as Promise<T>
}

function libraryQuery(params: { genre?: string; search?: string; sort?: string }): string {
  const qs = new URLSearchParams()
  if (params.genre) qs.set("genre", params.genre)
  if (params.search) qs.set("search", params.search)
  if (params.sort) qs.set("sort", params.sort)
  return qs.toString() ? `?${qs}` : ""
}

// --- movies ---
export const getLibrary = (params: { genre?: string; search?: string; sort?: string } = {}) =>
  req<{ items: Movie[] }>(`/media/library${libraryQuery(params)}`).then((r) => r.items)
export const getContinue = () => req<{ items: Movie[] }>("/media/continue").then((r) => r.items)
export const getLatest = () => req<{ items: Movie[] }>("/media/latest").then((r) => r.items)
export const getGenres = () => req<{ genres: string[] }>("/media/genres").then((r) => r.genres)
/** Audio tracks (+ preferred default) for the player's track menu; works for movies & episodes. */
export const getItemTracks = (itemId: string) =>
  req<ItemTracks>(`/media/item/${encodeURIComponent(itemId)}/tracks`)

export type ItemDownload = { url: string; filename: string; sizeBytes: number | null }

/**
 * Save an item's original file. The link is signed when asked for (not carried on
 * the list DTOs, whose signatures go stale in a long-open tab) and handed to the
 * browser's own download manager, so progress, pause and resume are the browser's.
 */
export async function downloadItem(itemId: string): Promise<ItemDownload> {
  const dl = await req<ItemDownload>(`/media/item/${encodeURIComponent(itemId)}/download`)
  const a = document.createElement("a")
  a.href = mediaUrl(dl.url)
  a.download = dl.filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  return dl
}

// --- tv ---
export const getSeries = (params: { genre?: string; search?: string; sort?: string } = {}) =>
  req<{ items: Series[] }>(`/media/series${libraryQuery(params)}`).then((r) => r.items)
export const getTvLatest = () => req<{ items: Series[] }>("/media/tv/latest").then((r) => r.items)
export const getTvContinue = () =>
  req<{ items: Episode[] }>("/media/tv/continue").then((r) => r.items)
export const getTvGenres = () => req<{ genres: string[] }>("/media/tv/genres").then((r) => r.genres)
export const getSeasons = (seriesId: string) =>
  req<{ items: Season[] }>(`/media/series/${seriesId}/seasons`).then((r) => r.items)
export const getEpisodes = (seriesId: string, seasonId: string) =>
  req<{ items: Episode[] }>(
    `/media/series/${seriesId}/episodes?seasonId=${encodeURIComponent(seasonId)}`
  ).then((r) => r.items)

// --- playback state ---
export const reportProgress = (itemId: string, positionTicks: number, paused = false) =>
  req<{ ok: boolean }>("/media/progress", {
    method: "POST",
    body: JSON.stringify({ itemId, positionTicks, paused }),
  })
export const reportStopped = (itemId: string, positionTicks: number) =>
  req<{ ok: boolean }>("/media/stopped", {
    method: "POST",
    body: JSON.stringify({ itemId, positionTicks }),
  })
export const setWatched = (itemId: string, played: boolean) =>
  req<{ ok: boolean }>("/media/watched", {
    method: "POST",
    body: JSON.stringify({ itemId, played }),
  })

// --- requests ---
export const discover = (q: string) =>
  req<{ results: DiscoverResult[] }>(`/media/requests/discover?q=${encodeURIComponent(q)}`).then(
    (r) => r.results
  )
export const requestMovie = (tmdbId: number) =>
  req<{ ok: boolean; id?: number; message?: string }>("/media/requests", {
    method: "POST",
    body: JSON.stringify({ tmdbId }),
  })
export const getQueue = () => req<RequestsStatus>("/media/requests/queue")

export const discoverTv = (q: string) =>
  req<{ results: DiscoverTv[] }>(`/media/requests/discover-tv?q=${encodeURIComponent(q)}`).then(
    (r) => r.results
  )
export const requestSeries = (tvdbId: number) =>
  req<{ ok: boolean; id?: number; message?: string }>("/media/requests/series", {
    method: "POST",
    body: JSON.stringify({ tvdbId }),
  })
export const getTvQueue = () => req<RequestsStatus>("/media/requests/tv-queue")
