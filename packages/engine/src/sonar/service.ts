import type {
  SonarHotspotRaw,
  SonarHotspotSearchResponse,
  SonarIssueRaw,
  SonarSearchResponse,
} from "./types"

const SONARCLOUD_BASE = "https://sonarcloud.io"
/** SonarCloud's max page size for /api/issues/search. */
const MAX_PAGE_SIZE = 500
/** SonarCloud refuses to page past 10k results (p * ps must stay <= 10000). */
const MAX_TOTAL = 10000

export interface SonarCloudConfig {
  organization: string
  projectKey: string
  /** Optional user token. The project is public, so this is only needed for
   *  higher rate limits or if the project becomes private. */
  token?: string
  baseUrl?: string
}

/**
 * Thin client over the SonarCloud Web API that pulls every issue for a project,
 * handling pagination. Authentication is optional (public projects are readable
 * anonymously); a Bearer token is attached only when provided.
 */
export class SonarCloudService {
  private readonly organization: string
  private readonly projectKey: string
  private readonly token?: string
  private readonly baseUrl: string

  constructor(config: SonarCloudConfig) {
    this.organization = config.organization
    this.projectKey = config.projectKey
    this.token = config.token
    this.baseUrl = config.baseUrl ?? SONARCLOUD_BASE
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }
    return headers
  }

  /** Fetch a single page of issues (1-indexed). */
  async fetchPage(page: number, pageSize: number = MAX_PAGE_SIZE): Promise<SonarSearchResponse> {
    const url = new URL("/api/issues/search", this.baseUrl)
    url.searchParams.set("organization", this.organization)
    url.searchParams.set("componentKeys", this.projectKey)
    url.searchParams.set("ps", String(pageSize))
    url.searchParams.set("p", String(page))

    const response = await fetch(url, { headers: this.headers() })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`SonarCloud request failed (${response.status}): ${body.slice(0, 200)}`)
    }
    return (await response.json()) as SonarSearchResponse
  }

  /** Pull every issue for the project, walking pages until exhausted. */
  async fetchAllIssues(): Promise<SonarIssueRaw[]> {
    const all: SonarIssueRaw[] = []
    let page = 1
    let total = Number.POSITIVE_INFINITY

    while (all.length < total && all.length < MAX_TOTAL) {
      const data = await this.fetchPage(page)
      total = data.paging?.total ?? data.total ?? all.length
      if (!data.issues || data.issues.length === 0) break
      all.push(...data.issues)
      if (page * MAX_PAGE_SIZE >= MAX_TOTAL) break
      page += 1
    }

    return all
  }

  /** Fetch a single page of security hotspots (1-indexed). */
  async fetchHotspotPage(
    page: number,
    pageSize: number = MAX_PAGE_SIZE
  ): Promise<SonarHotspotSearchResponse> {
    const url = new URL("/api/hotspots/search", this.baseUrl)
    // The hotspots API keys off projectKey (not componentKeys) and needs no org.
    url.searchParams.set("projectKey", this.projectKey)
    url.searchParams.set("ps", String(pageSize))
    url.searchParams.set("p", String(page))

    const response = await fetch(url, { headers: this.headers() })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(
        `SonarCloud hotspots request failed (${response.status}): ${body.slice(0, 200)}`
      )
    }
    return (await response.json()) as SonarHotspotSearchResponse
  }

  /** Pull every security hotspot for the project, walking pages until exhausted. */
  async fetchAllHotspots(): Promise<SonarHotspotRaw[]> {
    const all: SonarHotspotRaw[] = []
    let page = 1
    let total = Number.POSITIVE_INFINITY

    while (all.length < total && all.length < MAX_TOTAL) {
      const data = await this.fetchHotspotPage(page)
      total = data.paging?.total ?? all.length
      if (!data.hotspots || data.hotspots.length === 0) break
      all.push(...data.hotspots)
      if (page * MAX_PAGE_SIZE >= MAX_TOTAL) break
      page += 1
    }

    return all
  }
}
