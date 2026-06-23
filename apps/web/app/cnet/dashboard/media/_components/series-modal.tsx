"use client"

import { useQuery } from "@tanstack/react-query"
import { Check, Play, X } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type Episode,
  getEpisodes,
  getSeasons,
  mediaUrl,
  type Series,
  TICKS_PER_SECOND,
} from "@/lib/media-api"

function episodeProgress(ep: Episode): number {
  if (ep.playedPercentage && ep.playedPercentage > 0) return Math.min(100, ep.playedPercentage)
  if (ep.resumePositionTicks > 0 && ep.runtimeMinutes) {
    const watchedMin = ep.resumePositionTicks / TICKS_PER_SECOND / 60
    return Math.min(100, (watchedMin / ep.runtimeMinutes) * 100)
  }
  return 0
}

function EpisodeRow({ ep, onPlay }: { ep: Episode; onPlay: (e: Episode) => void }) {
  const pct = episodeProgress(ep)
  return (
    <button
      type="button"
      onClick={() => onPlay(ep)}
      className="group flex w-full gap-3 border-neutral-10 border-b p-2 text-left hover:bg-neutral-10"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-neutral-10">
        {ep.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(ep.posterUrl)}
            alt={ep.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          <Play className="h-7 w-7 text-white" />
        </span>
        {pct > 0 && pct < 100 ? (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-neutral-90 text-sm">
            {ep.episodeNumber != null ? `${ep.episodeNumber}. ` : ""}
            {ep.title}
            {ep.played ? <Check className="ml-1 inline h-3 w-3 text-green-600" /> : null}
          </p>
          {ep.runtimeMinutes ? (
            <span className="shrink-0 text-neutral-60 text-xs">{ep.runtimeMinutes}m</span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-neutral-60 text-xs">{ep.overview}</p>
      </div>
    </button>
  )
}

export function SeriesModal({
  series,
  onClose,
  onPlay,
}: {
  series: Series
  onClose: () => void
  onPlay: (e: Episode, episodes: Episode[]) => void
}) {
  const seasons = useQuery({
    queryKey: ["media", "seasons", series.id],
    queryFn: () => getSeasons(series.id),
  })
  const [seasonId, setSeasonId] = useState<string | null>(null)

  useEffect(() => {
    if (!seasonId && seasons.data && seasons.data.length > 0) setSeasonId(seasons.data[0].id)
  }, [seasons.data, seasonId])

  const episodes = useQuery({
    queryKey: ["media", "episodes", series.id, seasonId],
    queryFn: () => getEpisodes(series.id, seasonId as string),
    enabled: Boolean(seasonId),
  })

  const art = series.posterUrl ?? series.backdropUrl
  const epList = episodes.data ?? []
  const meta = [
    series.year ? String(series.year) : null,
    series.seasonCount ? `${series.seasonCount} season${series.seasonCount > 1 ? "s" : ""}` : null,
    series.officialRating || null,
    series.communityRating ? `★ ${series.communityRating.toFixed(1)}` : null,
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-8">
      <div className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[88vh] sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left: full artwork + description */}
        <div className="shrink-0 overflow-y-auto bg-neutral-90 text-white sm:max-h-[88vh] sm:w-80">
          <div className="aspect-[2/3] w-full bg-neutral-80">
            {art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(art)} alt={series.title} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="p-4">
            <h2 className="font-semibold text-lg">{series.title}</h2>
            {meta.length > 0 ? <p className="mt-1 text-white/60 text-xs">{meta.join(" · ")}</p> : null}
            {series.genres?.length ? (
              <p className="mt-2 text-white/70 text-xs">{series.genres.join(", ")}</p>
            ) : null}
            {series.overview ? (
              <p className="mt-3 text-sm text-white/80 leading-relaxed">{series.overview}</p>
            ) : null}
          </div>
        </div>

        {/* Right: season selector + scrollable episode list */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-neutral-90">Episodes</h3>
            {(seasons.data ?? []).length > 0 ? (
              <select
                value={seasonId ?? ""}
                onChange={(e) => setSeasonId(e.target.value)}
                aria-label="Select season"
                className="rounded-md border border-neutral-30 bg-white px-3 py-1.5 text-neutral-90 text-sm outline-none focus:border-neutral-60"
              >
                {(seasons.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.seasonNumber === 0 ? "Specials" : `Season ${s.seasonNumber}`}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {episodes.isFetching ? (
              <p className="py-4 text-center text-neutral-60 text-sm">Loading episodes…</p>
            ) : epList.length === 0 ? (
              <p className="py-4 text-center text-neutral-60 text-sm">No episodes available yet.</p>
            ) : (
              epList.map((ep) => (
                <EpisodeRow key={ep.id} ep={ep} onPlay={(e) => onPlay(e, epList)} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
