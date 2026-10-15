"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { type Movie, TICKS_PER_SECOND } from "@/lib/media-api"
import { cardVariants } from "./motion"
import { PosterImage } from "./poster-image"

function progressPercent(movie: Movie): number {
  if (movie.playedPercentage && movie.playedPercentage > 0)
    return Math.min(100, movie.playedPercentage)
  if (movie.resumePositionTicks > 0 && movie.runtimeMinutes) {
    const watchedMin = movie.resumePositionTicks / TICKS_PER_SECOND / 60
    return Math.min(100, (watchedMin / movie.runtimeMinutes) * 100)
  }
  return 0
}

export function MovieCard({
  movie,
  index = 0,
  onPlay,
}: {
  movie: Movie
  index?: number
  onPlay: (m: Movie) => void
}) {
  const pct = progressPercent(movie)
  return (
    <motion.button
      type="button"
      variants={cardVariants}
      custom={index}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onPlay(movie)}
      className="group w-36 shrink-0 text-left focus:outline-none"
      title={movie.title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-10 ring-1 ring-neutral-30 transition group-hover:ring-2 group-hover:ring-neutral-60">
        {movie.posterUrl ? (
          <PosterImage src={movie.posterUrl} alt={movie.title} />
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
    </motion.button>
  )
}
