export type RadarrImage = { coverType: string; remoteUrl?: string; url?: string }

export type RadarrLookupResult = {
  title: string
  year: number
  tmdbId: number
  overview?: string
  runtime?: number
  images?: RadarrImage[]
  remotePoster?: string
  hasFile?: boolean
  /** Present (non-zero) when the movie already exists in Radarr's library. */
  id?: number
}

export type RadarrMovie = {
  id: number
  title: string
  year: number
  tmdbId: number
  hasFile: boolean
  sizeOnDisk?: number
  monitored: boolean
  /** announced | inCinemas | released | deleted | tba */
  status?: string
  /** True once the movie meets its minimumAvailability, i.e. Radarr will search for it. */
  isAvailable?: boolean
  minimumAvailability?: string
  inCinemas?: string
  digitalRelease?: string
  physicalRelease?: string
  added?: string
  lastSearchTime?: string
}

export type RadarrQueueItem = {
  id: number
  movieId: number
  title: string
  status: string
  trackedDownloadStatus?: string
  trackedDownloadState?: string
  statusMessages?: Array<{ title?: string; messages?: string[] }>
  errorMessage?: string
  sizeleft?: number
  size?: number
  timeleft?: string
  indexer?: string
  downloadClient?: string
}

export type ArrHealthItem = { type?: string; source?: string; message?: string }
