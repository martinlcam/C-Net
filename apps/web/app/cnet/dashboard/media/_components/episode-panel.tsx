"use client"

import { useQuery } from "@tanstack/react-query"
import { Check, Play, X } from "lucide-react"
import { useEffect, useState } from "react"
import { type Episode, getEpisodes, getSeasons, mediaUrl, TICKS_PER_SECOND } from "@/lib/media-api"

function episodeProgress(ep: Episode): number {
  if (ep.playedPercentage && ep.playedPercentage > 0) return Math.min(100, ep.playedPercentage)
  if (ep.resumePositionTicks > 0 && ep.runtimeMinutes) {
    const watchedMin = ep.resumePositionTicks / TICKS_PER_SECOND / 60
    return Math.min(100, (watchedMin / ep.runtimeMinutes) * 100)
  }
  return 0
}

function EpisodeRow({
  ep,
  current,
  onPlay,
}: {
  ep: Episode
  current: boolean
  onPlay: () => void
}) {
  const pct = episodeProgress(ep)
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-current={current}
      className={`group flex w-full gap-3 rounded-md p-2 text-left transition ${
        current ? "bg-white/10 ring-1 ring-red-600/70" : "hover:bg-white/10"
      }`}
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-neutral-800">
        {ep.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(ep.posterUrl)}
            alt={ep.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition ${
            current ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Play className="h-6 w-6 fill-white text-white" />
        </span>
        {pct > 0 && pct < 100 ? (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/60">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium text-sm text-white">
            {ep.episodeNumber != null ? `${ep.episodeNumber}. ` : ""}
            {ep.title}
            {ep.played ? <Check className="ml-1 inline h-3 w-3 text-green-500" /> : null}
          </p>
          {ep.runtimeMinutes ? (
            <span className="shrink-0 text-white/50 text-xs">{ep.runtimeMinutes}m</span>
          ) : null}
        </div>
        {current ? (
          <p className="mt-0.5 font-medium text-red-500 text-xs">Now playing</p>
        ) : ep.overview ? (
          <p className="mt-0.5 line-clamp-2 text-white/50 text-xs leading-snug">{ep.overview}</p>
        ) : null}
      </div>
    </button>
  )
}

/**
 * In-player episode selector — a compact right-side panel (Netflix/Prime style): the
 * video keeps playing behind it, a season dropdown sits up top, and episodes scroll as
 * thumbnail rows with resume progress and the current episode highlighted. Selecting an
 * episode hands its whole season back as the new play queue so auto-advance still works.
 */
export function EpisodePanel({
  seriesId,
  seriesName,
  currentSeasonId,
  currentItemId,
  onSelect,
  onClose,
}: {
  seriesId: string
  seriesName?: string
  currentSeasonId?: string
  currentItemId: string
  onSelect: (episodes: Episode[], index: number) => void
  onClose: () => void
}) {
  const seasons = useQuery({
    queryKey: ["media", "seasons", seriesId],
    queryFn: () => getSeasons(seriesId),
  })
  const [seasonId, setSeasonId] = useState<string | null>(currentSeasonId ?? null)

  // Default to the playing episode's season, else the first available.
  useEffect(() => {
    if (seasonId || !seasons.data || seasons.data.length === 0) return
    setSeasonId(seasons.data[0].id)
  }, [seasons.data, seasonId])

  const episodes = useQuery({
    queryKey: ["media", "episodes", seriesId, seasonId],
    queryFn: () => getEpisodes(seriesId, seasonId as string),
    enabled: Boolean(seasonId),
  })
  const epList = episodes.data ?? []

  return (
    <div className="pointer-events-auto absolute inset-y-0 right-0 z-20 flex w-full max-w-[26rem] flex-col bg-neutral-950/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-white/10 border-b p-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">Episodes</p>
          {seriesName ? <p className="truncate text-white/50 text-xs">{seriesName}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {(seasons.data ?? []).length > 1 ? (
            <select
              value={seasonId ?? ""}
              onChange={(e) => setSeasonId(e.target.value)}
              aria-label="Select season"
              className="rounded-md border border-white/20 bg-neutral-900 px-2 py-1.5 text-sm text-white outline-none focus:border-white/50"
            >
              {(seasons.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.seasonNumber === 0 ? "Specials" : `Season ${s.seasonNumber}`}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close episodes"
            className="rounded-full p-1 hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {episodes.isFetching && epList.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">Loading episodes…</p>
        ) : epList.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">No episodes available.</p>
        ) : (
          epList.map((ep) => (
            <EpisodeRow
              key={ep.id}
              ep={ep}
              current={ep.id === currentItemId}
              onPlay={() =>
                onSelect(
                  epList,
                  epList.findIndex((e) => e.id === ep.id)
                )
              }
            />
          ))
        )}
      </div>
    </div>
  )
}
