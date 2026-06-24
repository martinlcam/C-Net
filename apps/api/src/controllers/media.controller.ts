import type { JellyfinItem, JellyfinMediaStream } from "@cnet/engine"
import type { Request as ExpressRequest } from "express"
import { Body, Controller, Get, Path, Post, Query, Request, Route, Security } from "tsoa"
import { getJellyfin } from "../media/clients"
import { resolveJellyfinUser, withJellyfinToken } from "../media/provision"
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

export interface AudioTrackDTO {
  /** Jellyfin MediaStream index — pass as `audioStreamIndex` on the HLS URL to select it. */
  index: number
  language: string | null
  label: string
}

export interface ItemTracksDTO {
  audio: AudioTrackDTO[]
  /** Preferred default track index (English, else Japanese, else file default). */
  preferredAudioIndex: number | null
}

// ISO 639-2/B codes → display name for the common audio languages we ship.
const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  jpn: "Japanese",
  spa: "Spanish",
  fra: "French",
  fre: "French",
  por: "Portuguese",
  ger: "German",
  deu: "German",
  ita: "Italian",
  kor: "Korean",
  chi: "Chinese",
  zho: "Chinese",
  rus: "Russian",
}

function audioLabel(s: JellyfinMediaStream): string {
  const lang = (s.Language ?? "").toLowerCase()
  return LANGUAGE_NAMES[lang] ?? s.DisplayTitle ?? s.Language ?? `Audio ${s.Index}`
}

/**
 * Audio tracks for an item plus the preferred default index. Anime is usually
 * dual-audio (English + Japanese) but ships with a non-English default flag
 * (often Spanish Latino), so we pick English first, then Japanese, then the
 * file's own default — the player loads that track and offers the rest.
 */
export function buildItemTracks(item: JellyfinItem): ItemTracksDTO {
  const audioStreams = (item.MediaStreams ?? []).filter((s) => s.Type === "Audio")
  const audio = audioStreams.map((s) => ({
    index: s.Index,
    language: s.Language ?? null,
    label: audioLabel(s),
  }))
  const byLang = (code: string) =>
    audioStreams.find((s) => (s.Language ?? "").toLowerCase() === code)
  const preferred =
    byLang("eng") ?? byLang("jpn") ?? audioStreams.find((s) => s.IsDefault) ?? audioStreams[0]
  return { audio, preferredAudioIndex: preferred ? preferred.Index : null }
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

  /** Audio tracks (+ preferred default) for a movie or episode, for the player's track menu. */
  @Get("item/{itemId}/tracks")
  public async getItemTracks(
    @Request() req: ExpressRequest,
    @Path() itemId: string
  ): Promise<ItemTracksDTO> {
    const actor = actorFrom(req)
    const { jellyfinUserId } = await resolveJellyfinUser(actor)
    return buildItemTracks(await getJellyfin().item(jellyfinUserId, itemId))
  }

  @Post("progress")
  public async reportProgress(
    @Request() req: ExpressRequest,
    @Body() body: ProgressBody
  ): Promise<{ ok: boolean }> {
    const actor = actorFrom(req)
    await withJellyfinToken(actor, (token) =>
      getJellyfin().reportProgress(token, body.itemId, body.positionTicks, body.paused ?? false)
    )
    return { ok: true }
  }

  @Post("stopped")
  public async reportStopped(
    @Request() req: ExpressRequest,
    @Body() body: StoppedBody
  ): Promise<{ ok: boolean }> {
    const actor = actorFrom(req)
    await withJellyfinToken(actor, (token) =>
      getJellyfin().reportStopped(token, body.itemId, body.positionTicks)
    )
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
