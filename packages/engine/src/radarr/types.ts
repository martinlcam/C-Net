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
  status?: string
}

export type RadarrQueueItem = {
  id: number
  movieId: number
  title: string
  status: string
  trackedDownloadStatus?: string
  trackedDownloadState?: string
  sizeleft?: number
  size?: number
  timeleft?: string
}
