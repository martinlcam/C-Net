export type JellyfinUser = { Id: string; Name: string }

export type JellyfinAuthResult = { AccessToken: string; User: JellyfinUser }

export type JellyfinUserData = {
  PlaybackPositionTicks?: number
  PlayedPercentage?: number
  Played?: boolean
}

export type JellyfinMediaStream = {
  Index: number
  Type?: string
  Codec?: string
  Language?: string
  DisplayTitle?: string
  IsDefault?: boolean
  IsForced?: boolean
  // Video-stream fields (Jellyfin returns them on every stream; only set for Type "Video").
  BitDepth?: number
  Profile?: string
  VideoRangeType?: string
}

/** One trickplay tile grid: JPEG sheets of TileWidth×TileHeight thumbnails, Width×Height each. */
export type JellyfinTrickplayInfo = {
  Width: number
  Height: number
  TileWidth: number
  TileHeight: number
  ThumbnailCount: number
  /** Milliseconds between consecutive thumbnails. */
  Interval: number
  Bandwidth?: number
}

export type JellyfinItem = {
  Id: string
  Name: string
  Type?: string
  ProductionYear?: number
  Overview?: string
  Genres?: string[]
  RunTimeTicks?: number
  CommunityRating?: number
  OfficialRating?: string
  ImageTags?: Record<string, string>
  BackdropImageTags?: string[]
  UserData?: JellyfinUserData
  MediaStreams?: JellyfinMediaStream[]
  MediaSources?: Array<{ Id: string; Container?: string; Size?: number }>
  Chapters?: Array<{ StartPositionTicks?: number; Name?: string }>
  // Scrub-preview tile grids keyed by media source id, then by tile width. Only present
  // once the library has trickplay extraction on and the item has been processed.
  Trickplay?: Record<string, Record<string, JellyfinTrickplayInfo>>
  // Series airing metadata from the provider (TVDB/TMDB); absent on movies and episodes.
  Status?: string
  AirDays?: string[]
  AirTime?: string
  ProviderIds?: Record<string, string>
  // TV (series / season / episode) fields
  IndexNumber?: number
  ParentIndexNumber?: number
  SeriesName?: string
  SeriesId?: string
  SeasonId?: string
  ChildCount?: number
}

export type JellyfinItemsResponse = { Items: JellyfinItem[]; TotalRecordCount: number }

export type JellyfinLibraryOpts = {
  genre?: string
  search?: string
  sortBy?: string
  sortDescending?: boolean
  limit?: number
}

export type JellyfinMediaType = "Movie" | "Episode"
