import type { JellyfinItem } from "@cnet/engine"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Path, Post, Query, Request, Route, Security } from "tsoa"
import { getJellyfin } from "../media/clients"
import { resolveJellyfinUser } from "../media/provision"
import { signMediaUrls } from "../media/urls"
import { actorFrom } from "../vault/access"

const TICKS_PER_MINUTE = 600_000_000

export interface MovieDTO {
  id: string
  title: string
  year?: number
  overview?: string
  genres: string[]
  runtimeMinutes?: number
  communityRating?: number
  officialRating?: string
  posterUrl: string | null
  backdropUrl: string | null
  streamUrl: string
  hlsUrl: string
  resumePositionTicks: number
  playedPercentage?: number
  played: boolean
}

export interface ProgressBody {
  itemId: string
  positionTicks: number
  paused?: boolean
}

export interface StoppedBody {
  itemId: string
  positionTicks: number
}

export interface WatchedBody {
  itemId: string
  played: boolean
}

/** Shared mapper: Jellyfin movie/episode item -> playable DTO with signed URLs. */
export function toMovieDTO(userId: string, item: JellyfinItem): MovieDTO {
  const urls = signMediaUrls(userId, item.Id)
  const hasPoster = Boolean(item.ImageTags?.Primary)
  const hasBackdrop = Boolean(item.BackdropImageTags?.length)
  return {
    id: item.Id,
    title: item.Name,
    year: item.ProductionYear,
    overview: item.Overview,
    genres: item.Genres ?? [],
    runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE) : undefined,
    communityRating: item.CommunityRating,
    officialRating: item.OfficialRating,
    posterUrl: hasPoster ? urls.posterUrl : null,
    backdropUrl: hasBackdrop ? urls.backdropUrl : null,
    streamUrl: urls.streamUrl,
    hlsUrl: urls.hlsUrl,
    resumePositionTicks: item.UserData?.PlaybackPositionTicks ?? 0,
    playedPercentage: item.UserData?.PlayedPercentage,
    played: item.UserData?.Played ?? false,
  }
}

@Route("media")
@Security("jwt")
export class MediaController extends Controller {
  @Get("library")
  public async getLibrary(
    @Request() req: ExpressRequest,
    @Query() genre?: string,
    @Query() search?: string,
    @Query() sort?: string
  ): Promise<{ items: MovieDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const res = await getJellyfin().library(jellyfinUserId, { genre, search, sortBy: sort })
    return { items: res.Items.map((i) => toMovieDTO(actor.id, i)) }
  }

  @Get("continue")
  public async getContinue(@Request() req: ExpressRequest): Promise<{ items: MovieDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const items = await getJellyfin().resume(jellyfinUserId, "Movie")
    return { items: items.map((i) => toMovieDTO(actor.id, i)) }
  }

  @Get("latest")
  public async getLatest(@Request() req: ExpressRequest): Promise<{ items: MovieDTO[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    const items = await getJellyfin().latest(jellyfinUserId)
    return { items: items.map((i) => toMovieDTO(actor.id, i)) }
  }

  @Get("genres")
  public async getGenres(@Request() req: ExpressRequest): Promise<{ genres: string[] }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    return { genres: await getJellyfin().genres(jellyfinUserId, "Movie") }
  }

  @Get("item/{itemId}")
  public async getItem(@Request() req: ExpressRequest, @Path() itemId: string): Promise<MovieDTO> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    return toMovieDTO(actor.id, await getJellyfin().item(jellyfinUserId, itemId))
  }

  @Post("progress")
  public async reportProgress(
    @Request() req: ExpressRequest,
    @Body() body: ProgressBody
  ): Promise<{ ok: boolean }> {
    const actor = actorFrom(req)
    const { token } = await resolveJellyfinUser(actor)
    await getJellyfin().reportProgress(token, body.itemId, body.positionTicks, body.paused ?? false)
    return { ok: true }
  }

  @Post("stopped")
  public async reportStopped(
    @Request() req: ExpressRequest,
    @Body() body: StoppedBody
  ): Promise<{ ok: boolean }> {
    const actor = actorFrom(req)
    const { token } = await resolveJellyfinUser(actor)
    await getJellyfin().reportStopped(token, body.itemId, body.positionTicks)
    return { ok: true }
  }

  @Post("watched")
  public async setWatched(
    @Request() req: ExpressRequest,
    @Body() body: WatchedBody
  ): Promise<{ ok: boolean }> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    await getJellyfin().setPlayed(jellyfinUserId, body.itemId, body.played)
    return { ok: true }
  }
}
