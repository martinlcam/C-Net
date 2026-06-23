import axios, { type AxiosInstance } from "axios"
import type { RadarrLookupResult, RadarrMovie, RadarrQueueItem } from "./types"

/** Thin client for Radarr's v3 API (discovery via TMDB-backed lookup + add/auto-search). */
export class RadarrService {
  private readonly client: AxiosInstance

  constructor(host: string, apiKey: string) {
    this.client = axios.create({
      baseURL: `${host.replace(/\/$/, "")}/api/v3`,
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      timeout: 20000,
    })
  }

  /** TMDB-backed search. `term` may be free text or `tmdb:<id>`. */
  async lookup(term: string): Promise<RadarrLookupResult[]> {
    const { data } = await this.client.get<RadarrLookupResult[]>("/movie/lookup", {
      params: { term },
    })
    return data
  }

  async getMovies(): Promise<RadarrMovie[]> {
    const { data } = await this.client.get<RadarrMovie[]>("/movie")
    return data
  }

  private async firstQualityProfileId(): Promise<number> {
    const { data } = await this.client.get<Array<{ id: number; name: string }>>("/qualityprofile")
    // Prefer a 1080p-only profile: browser-playable (if x264), ~5x smaller/faster than 4K.
    const hd1080 = data.find((p) => /1080/.test(p.name) && !/720/.test(p.name))
    return (hd1080 ?? data[0])?.id ?? 1
  }

  private async firstRootFolderPath(): Promise<string> {
    const { data } = await this.client.get<Array<{ path: string }>>("/rootfolder")
    return data[0]?.path ?? "/mnt/media/Movies"
  }

  /** Add a movie by TMDB id and immediately search for a release (auto-download). */
  async addMovie(tmdbId: number): Promise<RadarrMovie> {
    const [lookup] = await this.lookup(`tmdb:${tmdbId}`)
    if (!lookup) throw new Error(`No TMDB match for ${tmdbId}`)
    const [qualityProfileId, rootFolderPath] = await Promise.all([
      this.firstQualityProfileId(),
      this.firstRootFolderPath(),
    ])
    const { data } = await this.client.post<RadarrMovie>("/movie", {
      ...lookup,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      minimumAvailability: "released",
      addOptions: { searchForMovie: true },
    })
    return data
  }

  async getQueue(): Promise<RadarrQueueItem[]> {
    const { data } = await this.client.get<{ records: RadarrQueueItem[] }>("/queue", {
      params: { pageSize: 200, includeMovie: false },
    })
    return data.records ?? []
  }

  /** Total bytes used by the movie library (sum of per-movie sizeOnDisk). */
  async getLibrarySize(): Promise<number> {
    const movies = await this.getMovies()
    return movies.reduce((sum, m) => sum + (m.sizeOnDisk ?? 0), 0)
  }
}
