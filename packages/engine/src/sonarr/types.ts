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
  status?: string
  statistics?: SonarrStatistics
}

export type SonarrQueueItem = {
  id: number
  seriesId: number
  title: string
  status: string
  trackedDownloadState?: string
  sizeleft?: number
  size?: number
}
