export type JellyfinUser = { Id: string; Name: string }

export type JellyfinAuthResult = { AccessToken: string; User: JellyfinUser }

export type JellyfinUserData = {
  PlaybackPositionTicks?: number
  PlayedPercentage?: number
  Played?: boolean
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
  MediaSources?: Array<{ Id: string; Container?: string; Size?: number }>
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
