import axios, { type AxiosInstance, type AxiosResponse } from "axios"
import type {
  JellyfinAuthResult,
  JellyfinItem,
  JellyfinItemsResponse,
  JellyfinLibraryOpts,
  JellyfinMediaType,
  JellyfinUser,
} from "./types"

const ITEM_FIELDS =
  "Overview,Genres,RunTimeTicks,CommunityRating,OfficialRating,MediaSources,ProductionYear"

/**
 * Thin client for a single Jellyfin server, authenticated with the server-wide
 * admin API key. Catalog reads pass an explicit Jellyfin userId so per-user
 * UserData (resume position, played state) is correct; playback reporting uses
 * the caller's per-user access token so state is attributed to that user.
 */
export class JellyfinService {
  private readonly client: AxiosInstance
  readonly baseURL: string
  private readonly adminKey: string

  constructor(host: string, adminApiKey: string) {
    this.baseURL = host.replace(/\/$/, "")
    this.adminKey = adminApiKey
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: { "X-Emby-Token": adminApiKey, "Content-Type": "application/json" },
      timeout: 15000,
    })
  }

  // --- user provisioning ---

  async createUser(name: string): Promise<JellyfinUser> {
    const { data } = await this.client.post<JellyfinUser>("/Users/New", { Name: name })
    return data
  }

  async findUserByName(name: string): Promise<JellyfinUser | null> {
    const { data } = await this.client.get<JellyfinUser[]>("/Users")
    return data.find((u) => u.Name === name) ?? null
  }

  /**
   * Authenticate a (passwordless) Jellyfin user to mint a per-user access token.
   * `deviceId` MUST be unique per C-Net user: Jellyfin binds a token to its
   * (Client, Device) pair, so a shared device id makes each new user's login
   * revoke the previous user's token (silently breaking playback reporting).
   */
  async authenticate(name: string, deviceId: string): Promise<JellyfinAuthResult> {
    const { data } = await this.client.post<JellyfinAuthResult>(
      "/Users/AuthenticateByName",
      { Username: name, Pw: "" },
      {
        headers: {
          "X-Emby-Authorization": `MediaBrowser Client="cnet", Device="cnet-web", DeviceId="${deviceId}", Version="1.0.0"`,
        },
      }
    )
    return data
  }

  // --- catalog (generic) ---

  private async itemsOfType(
    userId: string,
    includeType: "Movie" | "Series",
    opts: JellyfinLibraryOpts
  ): Promise<JellyfinItemsResponse> {
    const params: Record<string, string | number | boolean> = {
      Recursive: true,
      IncludeItemTypes: includeType,
      Fields: ITEM_FIELDS,
      SortBy: opts.sortBy ?? "SortName",
      SortOrder: opts.sortDescending ? "Descending" : "Ascending",
    }
    if (opts.genre) params.Genres = opts.genre
    if (opts.search) params.SearchTerm = opts.search
    if (opts.limit) params.Limit = opts.limit
    const { data } = await this.client.get<JellyfinItemsResponse>(`/Users/${userId}/Items`, {
      params,
    })
    return data
  }

  // --- movies ---

  library(userId: string, opts: JellyfinLibraryOpts = {}): Promise<JellyfinItemsResponse> {
    return this.itemsOfType(userId, "Movie", opts)
  }

  async latest(userId: string, limit = 20): Promise<JellyfinItem[]> {
    // Sorted query is reliable; Jellyfin /Items/Latest returns [] for freshly-created users.
    const res = await this.itemsOfType(userId, "Movie", {
      sortBy: "DateCreated",
      sortDescending: true,
      limit,
    })
    return res.Items
  }

  // --- TV ---

  series(userId: string, opts: JellyfinLibraryOpts = {}): Promise<JellyfinItemsResponse> {
    return this.itemsOfType(userId, "Series", opts)
  }

  async latestSeries(userId: string, limit = 20): Promise<JellyfinItem[]> {
    const res = await this.itemsOfType(userId, "Series", {
      sortBy: "DateCreated",
      sortDescending: true,
      limit,
    })
    return res.Items
  }

  async seasons(userId: string, seriesId: string): Promise<JellyfinItem[]> {
    const { data } = await this.client.get<JellyfinItemsResponse>(`/Shows/${seriesId}/Seasons`, {
      params: { userId, Fields: ITEM_FIELDS },
    })
    return data.Items
  }

  async episodes(userId: string, seriesId: string, seasonId: string): Promise<JellyfinItem[]> {
    const { data } = await this.client.get<JellyfinItemsResponse>(`/Shows/${seriesId}/Episodes`, {
      params: { userId, seasonId, Fields: ITEM_FIELDS },
    })
    return data.Items
  }

  // --- shared ---

  async resume(userId: string, type?: JellyfinMediaType, limit = 20): Promise<JellyfinItem[]> {
    const params: Record<string, string | number | boolean> = {
      MediaTypes: "Video",
      Limit: limit,
      Fields: ITEM_FIELDS,
    }
    if (type) params.IncludeItemTypes = type
    const { data } = await this.client.get<JellyfinItemsResponse>(`/Users/${userId}/Items/Resume`, {
      params,
    })
    return data.Items
  }

  async genres(userId: string, includeType: "Movie" | "Series" = "Movie"): Promise<string[]> {
    const { data } = await this.client.get<{ Items: Array<{ Name: string }> }>("/Genres", {
      params: { IncludeItemTypes: includeType, userId },
    })
    return (data.Items ?? []).map((g) => g.Name)
  }

  async item(userId: string, itemId: string): Promise<JellyfinItem> {
    const { data } = await this.client.get<JellyfinItem>(`/Users/${userId}/Items/${itemId}`)
    return data
  }

  // --- playback state (per-user token) ---

  async reportProgress(
    userToken: string,
    itemId: string,
    positionTicks: number,
    paused = false
  ): Promise<void> {
    await this.client.post(
      "/Sessions/Playing/Progress",
      { ItemId: itemId, PositionTicks: positionTicks, IsPaused: paused, PlayMethod: "DirectPlay" },
      { headers: { "X-Emby-Token": userToken } }
    )
  }

  async reportStopped(userToken: string, itemId: string, positionTicks: number): Promise<void> {
    await this.client.post(
      "/Sessions/Playing/Stopped",
      { ItemId: itemId, PositionTicks: positionTicks },
      { headers: { "X-Emby-Token": userToken } }
    )
  }

  async setPlayed(userId: string, itemId: string, played: boolean): Promise<void> {
    const path = `/Users/${userId}/PlayedItems/${itemId}`
    if (played) await this.client.post(path)
    else await this.client.delete(path)
  }

  // --- binary proxies (server-side fetch; routes relay to the browser) ---

  imageStream(itemId: string, type = "Primary"): Promise<AxiosResponse> {
    return this.client.get(`/Items/${itemId}/Images/${type}`, { responseType: "stream" })
  }

  /**
   * Direct-play fetch with optional Range. Returns a web Response so the route
   * can stream it with real backpressure (and abort on client disconnect) —
   * critical because library files can be many GB and CT110 has little RAM.
   */
  videoFetch(itemId: string, range?: string, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { "X-Emby-Token": this.adminKey }
    if (range) headers.Range = range
    return fetch(`${this.baseURL}/Videos/${itemId}/stream?static=true`, { headers, signal })
  }

  /**
   * Fetch an arbitrary Jellyfin resource (HLS playlist or segment) with admin
   * auth via header (so the key never appears in any browser-visible URL).
   */
  streamFetch(relpath: string, signal?: AbortSignal): Promise<Response> {
    return fetch(`${this.baseURL}/${relpath}`, {
      headers: { "X-Emby-Token": this.adminKey },
      signal,
    })
  }
}
