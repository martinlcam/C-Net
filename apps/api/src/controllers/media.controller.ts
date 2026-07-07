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

export interface SubtitleTrackDTO {
  /** Jellyfin MediaStream index — fetch `.../Subtitles/{index}/0/Stream.vtt` for the full track. */
  index: number
  language: string | null
  label: string
  /** Forced/"Signs & Songs" track (only signs + song lyrics, for dub watchers). */
  forced: boolean
}

export interface ItemTracksDTO {
  audio: AudioTrackDTO[]
  /**
   * Selectable text subtitle tracks. Image subs (PGS/DVD) are excluded — they
   * can't be delivered as WebVTT, so the player can't render them anyway. We
   * serve each as one full `Stream.vtt` (not HLS-segmented, which Jellyfin
   * mis-windows for heavily-typeset anime ASS — only the OP gets cues).
   */
  subtitles: SubtitleTrackDTO[]
  /** Preferred default track index (English, else Japanese, else file default). */
  preferredAudioIndex: number | null
  /**
   * Seconds into the item where the end credits / ED start, from chapter markers
   * (anime "ED"/"Ending"/"Credits"/"Outro"). Lets the player pop the "Up next" card
   * when the credits begin instead of a fixed few-seconds-before-end. Null if the
   * item has no such chapter.
   */
  creditsStartSeconds: number | null
  /**
   * Intro/OP [start, end) in seconds (from chapters) for the "Skip Intro" button —
   * shown while playback is inside the range, seeks to `introEndSeconds` on click.
   * Both null if the item has no OP chapter.
   */
  introStartSeconds: number | null
  introEndSeconds: number | null
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

// Image-based subtitle codecs can't be converted to WebVTT, so we don't offer them.
const IMAGE_SUB_CODECS = new Set([
  "pgssub",
  "hdmv_pgs_subtitle",
  "dvdsub",
  "dvd_subtitle",
  "dvbsub",
  "dvb_subtitle",
  "xsub",
])

function subtitleLabel(s: JellyfinMediaStream): string {
  const lang = (s.Language ?? "").toLowerCase()
  return s.DisplayTitle ?? LANGUAGE_NAMES[lang] ?? s.Language ?? `Subtitle ${s.Index}`
}

// Chapter names that mark the start of the end credits / ED (anime convention).
const CREDITS_CHAPTER = /^(ed|ending|credits?|outro|end\s*credits?)$/i

/** Seconds into the item where the end credits start, from chapter markers, or null. */
function creditsStartSeconds(item: JellyfinItem): number | null {
  const credit = (item.Chapters ?? []).find((c) => CREDITS_CHAPTER.test((c.Name ?? "").trim()))
  if (!credit?.StartPositionTicks) return null
  return Math.round(credit.StartPositionTicks / 10_000_000)
}

// Chapter names that mark the intro / opening (OP). Not "prologue"/"cold open" —
// those are story, not the skippable OP.
const INTRO_CHAPTER = /^(op|opening|intro)$/i
const TICKS_PER_SEC = 10_000_000

/**
 * Intro [start, end) seconds from chapters: the OP chapter's start to the start of
 * the chapter that follows it. Null if there's no OP chapter or nothing after it —
 * there's no reliable time-based fallback for where an OP is without a marker.
 */
function introRangeSeconds(item: JellyfinItem): { start: number; end: number } | null {
  const chapters = item.Chapters ?? []
  const i = chapters.findIndex((c) => INTRO_CHAPTER.test((c.Name ?? "").trim()))
  if (i === -1) return null
  const start = chapters[i].StartPositionTicks
  const end = chapters[i + 1]?.StartPositionTicks
  if (start == null || end == null) return null
  return { start: Math.round(start / TICKS_PER_SEC), end: Math.round(end / TICKS_PER_SEC) }
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
  const subtitles = (item.MediaStreams ?? [])
    .filter((s) => s.Type === "Subtitle" && !IMAGE_SUB_CODECS.has((s.Codec ?? "").toLowerCase()))
    .map((s) => ({
      index: s.Index,
      language: s.Language ?? null,
      label: subtitleLabel(s),
      forced: s.IsForced ?? false,
    }))
  const byLang = (code: string) =>
    audioStreams.find((s) => (s.Language ?? "").toLowerCase() === code)
  const preferred =
    byLang("eng") ?? byLang("jpn") ?? audioStreams.find((s) => s.IsDefault) ?? audioStreams[0]
  const intro = introRangeSeconds(item)
  return {
    audio,
    subtitles,
    preferredAudioIndex: preferred ? preferred.Index : null,
    creditsStartSeconds: creditsStartSeconds(item),
    introStartSeconds: intro?.start ?? null,
    introEndSeconds: intro?.end ?? null,
  }
}

/** Shared mapper: Jellyfin movie/episode item -> playable DTO with signed URLs. */
export function toMovieDTO(userId: string, item: JellyfinItem): MovieDTO {
  const urls = signMediaUrls(userId, item.Id)
  const hasPoster = Boolean(item.ImageTags?.Primary)
  const hasBackdrop = (item.BackdropImageTags?.length ?? 0) > 0
  return {
    id: item.Id,
    title: item.Name,
    year: item.ProductionYear,
    overview: item.Overview,
    genres: item.Genres ?? [],
    runtimeMinutes: item.RunTimeTicks
      ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE)
      : undefined,
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
