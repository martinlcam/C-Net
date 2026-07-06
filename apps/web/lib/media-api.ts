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
export type ItemTracks = {
  audio: AudioTrack[]
  subtitles: SubtitleTrack[]
  preferredAudioIndex: number | null
  creditsStartSeconds: number | null
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

export type QueueItem = {
  id: number
  title: string
  status: string
  state?: string
  progress: number
}

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
export const getQueue = () =>
  req<{ items: QueueItem[] }>("/media/requests/queue").then((r) => r.items)

export const discoverTv = (q: string) =>
  req<{ results: DiscoverTv[] }>(`/media/requests/discover-tv?q=${encodeURIComponent(q)}`).then(
    (r) => r.results
  )
export const requestSeries = (tvdbId: number) =>
  req<{ ok: boolean; id?: number; message?: string }>("/media/requests/series", {
    method: "POST",
    body: JSON.stringify({ tvdbId }),
  })
export const getTvQueue = () =>
  req<{ items: QueueItem[] }>("/media/requests/tv-queue").then((r) => r.items)
