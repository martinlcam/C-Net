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
      className="flex w-full gap-3 border-neutral-10 border-b py-2 text-left hover:bg-neutral-10"
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-neutral-10">
        {ep.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(ep.posterUrl)} alt={ep.title} className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <Play className="h-6 w-6 text-white" />
        </span>
        {pct > 0 && pct < 100 ? (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-neutral-90 text-sm">
          {ep.episodeNumber != null ? `${ep.episodeNumber}. ` : ""}
          {ep.title}
          {ep.played ? <Check className="ml-1 inline h-3 w-3 text-green-600" /> : null}
        </p>
        <p className="line-clamp-2 text-neutral-60 text-xs">{ep.overview}</p>
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
  onPlay: (e: Episode) => void
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:p-10">
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg text-neutral-90">
              {series.title}
              {series.year ? <span className="text-neutral-60"> ({series.year})</span> : null}
            </h2>
            {series.overview ? (
              <p className="mt-1 line-clamp-2 text-neutral-60 text-sm">{series.overview}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {(seasons.data ?? []).map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSeasonId(s.id)}
              className={`rounded-md px-3 py-1 text-sm ${
                s.id === seasonId
                  ? "bg-neutral-90 text-white"
                  : "bg-neutral-10 text-neutral-70 hover:bg-neutral-30"
              }`}
            >
              {s.seasonNumber === 0 ? "Specials" : `Season ${s.seasonNumber}`}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {episodes.isFetching ? (
            <p className="py-4 text-center text-neutral-60 text-sm">Loading episodes…</p>
          ) : (episodes.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-neutral-60 text-sm">No episodes available yet.</p>
          ) : (
            (episodes.data ?? []).map((ep) => <EpisodeRow key={ep.id} ep={ep} onPlay={onPlay} />)
          )}
        </div>
      </div>
    </div>
  )
}
