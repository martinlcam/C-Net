"use client"

import type { Movie } from "@/lib/media-api"
import { MovieCard } from "./movie-card"

export function MovieRow({
  title,
  movies,
  onPlay,
}: {
  title: string
  movies: Movie[]
  onPlay: (m: Movie) => void
}) {
  if (movies.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-lg text-neutral-90">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {movies.map((m) => (
          <MovieCard key={m.id} movie={m} onPlay={onPlay} />
        ))}
      </div>
    </section>
  )
}
