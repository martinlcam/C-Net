export type SonarrImage = { coverType: string; remoteUrl?: string; url?: string }

export type SonarrStatistics = {
  episodeFileCount?: number
  episodeCount?: number
  sizeOnDisk?: number
}

export type SonarrLookupResult = {
  title: string
  year: number
  tvdbId: number
  overview?: string
  images?: SonarrImage[]
  remotePoster?: string
  status?: string
  network?: string
  /** Present (non-zero) when the series already exists in Sonarr's library. */
  id?: number
  statistics?: SonarrStatistics
}

export type SonarrSeries = {
  id: number
  title: string
  year: number
  tvdbId: number
  monitored: boolean
  /** continuing | ended | upcoming */
  status?: string
  /** ISO time of the next episode to air, when the show is still releasing. */
  nextAiring?: string
  previousAiring?: string
  airTime?: string
  network?: string
  statistics?: SonarrStatistics
}

export type SonarrQueueItem = {
  id: number
  seriesId: number
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

/** A monitored episode Sonarr has no file for (`/wanted/missing` with includeSeries). */
export type SonarrMissingEpisode = {
  id: number
  seriesId: number
  seasonNumber: number
  episodeNumber: number
  title?: string
  airDateUtc?: string
  series?: { id: number; title: string }
}
