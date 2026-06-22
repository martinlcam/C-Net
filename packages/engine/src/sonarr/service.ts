import axios, { type AxiosInstance } from "axios"
import type { SonarrLookupResult, SonarrQueueItem, SonarrSeries } from "./types"

/** Thin client for Sonarr's v3 API (TVDB-backed lookup + add/auto-search). */
export class SonarrService {
  private readonly client: AxiosInstance

  constructor(host: string, apiKey: string) {
    this.client = axios.create({
      baseURL: `${host.replace(/\/$/, "")}/api/v3`,
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      timeout: 20000,
    })
  }

  /** TVDB-backed search. `term` may be free text or `tvdb:<id>`. */
  async lookup(term: string): Promise<SonarrLookupResult[]> {
    const { data } = await this.client.get<SonarrLookupResult[]>("/series/lookup", {
      params: { term },
    })
    return data
  }

  async getSeries(): Promise<SonarrSeries[]> {
    const { data } = await this.client.get<SonarrSeries[]>("/series")
    return data
  }

  private async firstQualityProfileId(): Promise<number> {
    const { data } = await this.client.get<Array<{ id: number }>>("/qualityprofile")
    return data[0]?.id ?? 1
  }

  private async firstRootFolderPath(): Promise<string> {
    const { data } = await this.client.get<Array<{ path: string }>>("/rootfolder")
    return data[0]?.path ?? "/mnt/media/TV"
  }

  /** Add a series by TVDB id and search for missing episodes (auto-download). */
  async addSeries(tvdbId: number): Promise<SonarrSeries> {
    const [lookup] = await this.lookup(`tvdb:${tvdbId}`)
    if (!lookup) throw new Error(`No TVDB match for ${tvdbId}`)
    const [qualityProfileId, rootFolderPath] = await Promise.all([
      this.firstQualityProfileId(),
      this.firstRootFolderPath(),
    ])
    const { data } = await this.client.post<SonarrSeries>("/series", {
      ...lookup,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      seasonFolder: true,
      seriesType: "standard",
      addOptions: { monitor: "all", searchForMissingEpisodes: true },
    })
    return data
  }

  async getQueue(): Promise<SonarrQueueItem[]> {
    const { data } = await this.client.get<{ records: SonarrQueueItem[] }>("/queue", {
      params: { pageSize: 200, includeSeries: false },
    })
    return data.records ?? []
  }

  /** Total bytes used by the TV library (sum of per-series sizeOnDisk). */
  async getLibrarySize(): Promise<number> {
    const series = await this.getSeries()
    return series.reduce((sum, s) => sum + (s.statistics?.sizeOnDisk ?? 0), 0)
  }
}
