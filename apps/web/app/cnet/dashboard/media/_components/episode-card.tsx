"use client"

import { type Episode, mediaUrl, TICKS_PER_SECOND } from "@/lib/media-api"

function progressPercent(ep: Episode): number {
  if (ep.playedPercentage && ep.playedPercentage > 0) return Math.min(100, ep.playedPercentage)
  if (ep.resumePositionTicks > 0 && ep.runtimeMinutes) {
    const watchedMin = ep.resumePositionTicks / TICKS_PER_SECOND / 60
    return Math.min(100, (watchedMin / ep.runtimeMinutes) * 100)
  }
  return 0
}

export function EpisodeCard({
  episode,
  onPlay,
}: {
  episode: Episode
  onPlay: (e: Episode) => void
}) {
  const pct = progressPercent(episode)
  const tag =
    episode.seasonNumber != null && episode.episodeNumber != null
      ? `S${episode.seasonNumber}E${episode.episodeNumber} · ${episode.title}`
      : episode.title
  return (
    <button
      type="button"
      onClick={() => onPlay(episode)}
      className="group w-48 shrink-0 text-left focus:outline-none"
      title={`${episode.seriesName ?? ""} ${tag}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-neutral-10 ring-1 ring-neutral-30 transition group-hover:ring-2 group-hover:ring-neutral-60">
        {episode.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(episode.posterUrl)}
            alt={episode.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        {pct > 0 && pct < 100 ? (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <p className="mt-1 truncate font-medium text-neutral-90 text-sm">
        {episode.seriesName ?? episode.title}
      </p>
      <p className="truncate text-neutral-60 text-xs">{tag}</p>
    </button>
  )
}
