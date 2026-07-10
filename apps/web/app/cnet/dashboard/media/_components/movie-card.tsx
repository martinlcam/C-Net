"use client"

import { Check } from "lucide-react"
import { type Movie, mediaUrl, TICKS_PER_SECOND } from "@/lib/media-api"

function progressPercent(movie: Movie): number {
  if (movie.playedPercentage && movie.playedPercentage > 0)
    return Math.min(100, movie.playedPercentage)
  if (movie.resumePositionTicks > 0 && movie.runtimeMinutes) {
    const watchedMin = movie.resumePositionTicks / TICKS_PER_SECOND / 60
    return Math.min(100, (watchedMin / movie.runtimeMinutes) * 100)
  }
  return 0
}

export function MovieCard({ movie, onPlay }: { movie: Movie; onPlay: (m: Movie) => void }) {
  const pct = progressPercent(movie)
  return (
    <button
      type="button"
      onClick={() => onPlay(movie)}
      className="group w-36 shrink-0 text-left focus:outline-none"
      title={movie.title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-10 ring-1 ring-neutral-30 transition group-hover:ring-2 group-hover:ring-neutral-60">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          // biome-ignore lint/performance/noImgElement: media posters are remote API URLs; next/image would need env-dependent remotePatterns
          <img
            src={mediaUrl(movie.posterUrl)}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-neutral-70 text-xs">
            {movie.title}
          </div>
        )}
        {movie.played ? (
          <span className="absolute top-1 right-1 rounded-full bg-green-600/90 p-0.5 text-white">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
        {pct > 0 && pct < 100 ? (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <p className="mt-1 truncate font-medium text-neutral-90 text-sm">{movie.title}</p>
      {movie.year ? <p className="text-neutral-60 text-xs">{movie.year}</p> : null}
    </button>
  )
}
