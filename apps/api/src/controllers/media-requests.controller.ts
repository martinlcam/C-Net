import {
  describeHealth,
  describeMissingEpisodes,
  describeMissingMovie,
  describeQueueItem,
} from "@cnet/engine"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Post, Query, Request, Response, Route, Security } from "tsoa"
import { getRadarr, getSonarr } from "../media/clients"
import { actorFrom } from "../vault/access"

export interface DiscoverDTO {
  tmdbId: number
  title: string
  year: number
  overview?: string
  posterUrl?: string
  inLibrary: boolean
  hasFile: boolean
}

export interface DiscoverTvDTO {
  tvdbId: number
  title: string
  year: number
  overview?: string
  posterUrl?: string
  network?: string
  inLibrary: boolean
}

export interface RequestBody {
  tmdbId: number
}

export interface SeriesRequestBody {
  tvdbId: number
}

export interface RequestResult {
  ok: boolean
  id?: number
  message?: string
}

export type RequestPhaseDTO =
  | "waiting"
  | "searching"
  | "queued"
  | "downloading"
  | "paused"
  | "stalled"
  | "importing"
  | "failed"

/** One requested title and where it is: waiting for release, searching, downloading, stuck… */
export interface RequestStatusDTO {
  id: number
  title: string
  phase: RequestPhaseDTO
  label: string
  detail: string | null
  progress: number | null
  etaSeconds: number | null
}

export interface HealthNoticeDTO {
  level: "warning" | "error"
  message: string
}

export interface RequestsStatusResponse {
  items: RequestStatusDTO[]
  /** Indexer or download-client problems that explain why nothing moves. */
  health: HealthNoticeDTO[]
}

function libraryCapBytes(): number {
  const raw = process.env.MEDIA_LIBRARY_CAP_BYTES
  const n = raw ? Number(raw) : Number.NaN
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

/** Combined movie + TV usage, since both share the tank_main/media dataset. */
async function totalLibraryBytes(): Promise<number> {
  const [movies, tv] = await Promise.all([
    getRadarr().getLibrarySize(),
    getSonarr().getLibrarySize(),
  ])
  return movies + tv
}

@Route("media/requests")
@Security("jwt")
export class MediaRequestsController extends Controller {
  // --- movies ---

  @Get("discover")
  public async discover(
    @Request() req: ExpressRequest,
    @Query() q: string
  ): Promise<{ results: DiscoverDTO[] }> {
    actorFrom(req)
    const results = await getRadarr().lookup(q)
    return {
      results: results.slice(0, 30).map((r) => ({
        tmdbId: r.tmdbId,
        title: r.title,
        year: r.year,
        overview: r.overview,
        posterUrl: r.remotePoster ?? r.images?.find((i) => i.coverType === "poster")?.remoteUrl,
        inLibrary: Boolean(r.id && r.id > 0),
        hasFile: Boolean(r.hasFile),
      })),
    }
  }

  @Post()
  @Response<RequestResult>(507, "Library full")
  public async create(
    @Request() req: ExpressRequest,
    @Body() body: RequestBody
  ): Promise<RequestResult> {
    actorFrom(req)
    const cap = libraryCapBytes()
    if (Number.isFinite(cap) && (await totalLibraryBytes()) >= cap) {
      this.setStatus(507)
      return { ok: false, message: "Media library is full — ask the admin to free space." }
    }
    try {
      const movie = await getRadarr().addMovie(body.tmdbId)
      return { ok: true, id: movie.id }
    } catch {
      this.setStatus(409)
      return { ok: false, message: "Already requested or in library." }
    }
  }

  /** Every outstanding movie request: in the download queue, or still wanted and why. */
  @Get("queue")
  public async queue(@Request() req: ExpressRequest): Promise<RequestsStatusResponse> {
    actorFrom(req)
    const radarr = getRadarr()
    const [queue, wanted, health] = await Promise.all([
      radarr.getQueue(),
      radarr.getWantedMissing().catch(() => []),
      radarr.getHealth().catch(() => []),
    ])
    const queued = new Set(queue.map((it) => it.movieId))
    const items = [
      ...queue.map((it) => describeQueueItem(it.movieId, it)),
      ...wanted
        .filter((m) => !queued.has(m.id) && !m.hasFile)
        .sort((a, b) => String(b.added ?? "").localeCompare(String(a.added ?? "")))
        .map((m) => describeMissingMovie(m)),
    ]
    return { items, health: describeHealth(health) }
  }

  // --- TV ---

  @Get("discover-tv")
  public async discoverTv(
    @Request() req: ExpressRequest,
    @Query() q: string
  ): Promise<{ results: DiscoverTvDTO[] }> {
    actorFrom(req)
    const results = await getSonarr().lookup(q)
    return {
      results: results.slice(0, 30).map((r) => ({
        tvdbId: r.tvdbId,
        title: r.title,
        year: r.year,
        overview: r.overview,
        posterUrl: r.remotePoster ?? r.images?.find((i) => i.coverType === "poster")?.remoteUrl,
        network: r.network,
        inLibrary: Boolean(r.id && r.id > 0),
      })),
    }
  }

  @Post("series")
  @Response<RequestResult>(507, "Library full")
  public async createSeries(
    @Request() req: ExpressRequest,
    @Body() body: SeriesRequestBody
  ): Promise<RequestResult> {
    actorFrom(req)
    const cap = libraryCapBytes()
    if (Number.isFinite(cap) && (await totalLibraryBytes()) >= cap) {
      this.setStatus(507)
      return { ok: false, message: "Media library is full — ask the admin to free space." }
    }
    try {
      const series = await getSonarr().addSeries(body.tvdbId)
      return { ok: true, id: series.id }
    } catch {
      this.setStatus(409)
      return { ok: false, message: "Already requested or in library." }
    }
  }

  /** Every outstanding TV download plus series with missing episodes and why. */
  @Get("tv-queue")
  public async tvQueue(@Request() req: ExpressRequest): Promise<RequestsStatusResponse> {
    actorFrom(req)
    const sonarr = getSonarr()
    const [queue, missing, health] = await Promise.all([
      sonarr.getQueue(),
      sonarr.getMissingEpisodes().catch(() => []),
      sonarr.getHealth().catch(() => []),
    ])
    const queued = new Set(queue.map((it) => it.seriesId))
    const items = [
      ...queue.map((it) => describeQueueItem(it.seriesId, it)),
      ...describeMissingEpisodes(missing).filter((s) => !queued.has(s.id)),
    ]
    return { items, health: describeHealth(health) }
  }
}
