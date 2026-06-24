import type { JellyfinItem } from "@cnet/engine"
import type { Request as ExpressRequest } from "express"
import { Controller, Get, Path, Query, Request, Route, Security } from "tsoa"
import { getJellyfin } from "../media/clients"
import { resolveJellyfinUser } from "../media/provision"
import { signMediaUrls } from "../media/urls"
import { actorFrom } from "../vault/access"

const TICKS_PER_MINUTE = 600_000_000

export interface SeriesDTO {
  id: string
  title: string
  year?: number
  overview?: string
  genres: string[]
  communityRating?: number
  officialRating?: string
  posterUrl: string | null
  backdropUrl: string | null
  seasonCount?: number
}

export interface SeasonDTO {
  id: string
  name: string
  seasonNumber: number
  posterUrl: string | null
}

export interface EpisodeDTO {
  id: string
  title: string
  overview?: string
  seriesName?: string
  seasonNumber?: number
  episodeNumber?: number
  runtimeMinutes?: number
  posterUrl: string | null
  streamUrl: string
  hlsUrl: string
  resumePositionTicks: number
  playedPercentage?: number
  played: boolean
}

function toSeriesDTO(userId: string, item: JellyfinItem): SeriesDTO {
  const urls = signMediaUrls(userId, item.Id)
  return {
    id: item.Id,
    title: item.Name,
    year: item.ProductionYear,
    overview: item.Overview,
    genres: item.Genres ?? [],
    communityRating: item.CommunityRating,
    officialRating: item.OfficialRating,
    posterUrl: item.ImageTags?.Primary ? urls.posterUrl : null,
    backdropUrl: (item.BackdropImageTags?.length ?? 0) > 0 ? urls.backdropUrl : null,
    seasonCount: item.ChildCount,
  }
}

function toSeasonDTO(userId: string, item: JellyfinItem): SeasonDTO {
  return {
    id: item.Id,
    name: item.Name,
    seasonNumber: item.IndexNumber ?? 0,
    posterUrl: item.ImageTags?.Primary ? signMediaUrls(userId, item.Id).posterUrl : null,
  }
}

function toEpisodeDTO(userId: string, item: JellyfinItem): EpisodeDTO {
  const urls = signMediaUrls(userId, item.Id)
  return {
    id: item.Id,
    title: item.Name,
    overview: item.Overview,
    seriesName: item.SeriesName,
    seasonNumber: item.ParentIndexNumber,
    episodeNumber: item.IndexNumber,
    runtimeMinutes: item.RunTimeTicks
      ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE)
      : undefined,
    posterUrl: item.ImageTags?.Primary ? urls.posterUrl : null,
    streamUrl: urls.streamUrl,
    hlsUrl: urls.hlsUrl,
    resumePositionTicks: item.UserData?.PlaybackPositionTicks ?? 0,
    playedPercentage: item.UserData?.PlayedPercentage,
    played: item.UserData?.Played ?? false,
  }
}

@Route("media")
@Security("jwt")
export class MediaTvController extends Controller {
  @Get("series")
  public async getSeries(
    @Request() req: ExpressRequest,
    @Query() genre?: string,
    @Query() search?: string,
    @Query() sort?: string
  ): Promise<{ items: SeriesDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const res = await getJellyfin().series(jellyfinUserId, { genre, search, sortBy: sort })
    return { items: res.Items.map((i) => toSeriesDTO(actor.id, i)) }
  }

  @Get("tv/latest")
  public async getTvLatest(@Request() req: ExpressRequest): Promise<{ items: SeriesDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const items = await getJellyfin().latestSeries(jellyfinUserId)
    return { items: items.map((i) => toSeriesDTO(actor.id, i)) }
  }

  @Get("tv/continue")
  public async getTvContinue(@Request() req: ExpressRequest): Promise<{ items: EpisodeDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const items = await getJellyfin().resume(jellyfinUserId, "Episode")
    return { items: items.map((i) => toEpisodeDTO(actor.id, i)) }
  }

  @Get("tv/genres")
  public async getTvGenres(@Request() req: ExpressRequest): Promise<{ genres: string[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    return { genres: await getJellyfin().genres(jellyfinUserId, "Series") }
  }

  @Get("series/{seriesId}/seasons")
  public async getSeasons(
    @Request() req: ExpressRequest,
    @Path() seriesId: string
  ): Promise<{ items: SeasonDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const seasons = await getJellyfin().seasons(jellyfinUserId, seriesId)
    return { items: seasons.map((s) => toSeasonDTO(actor.id, s)) }
  }

  @Get("series/{seriesId}/episodes")
  public async getEpisodes(
    @Request() req: ExpressRequest,
    @Path() seriesId: string,
    @Query() seasonId: string
  ): Promise<{ items: EpisodeDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const eps = await getJellyfin().episodes(jellyfinUserId, seriesId, seasonId)
    return { items: eps.map((e) => toEpisodeDTO(actor.id, e)) }
  }
}
