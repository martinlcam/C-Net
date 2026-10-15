"use client"

import { motion } from "framer-motion"
import type { Movie } from "@/lib/media-api"
import { rowVariants } from "./motion"
import { MovieCard } from "./movie-card"
import { RowSkeleton } from "./skeletons"

export function MovieRow({
  title,
  movies,
  loading = false,
  onPlay,
}: {
  title: string
  movies: Movie[]
  loading?: boolean
  onPlay: (m: Movie) => void
}) {
  if (movies.length === 0) return loading ? <RowSkeleton /> : null
  return (
    <motion.section variants={rowVariants} initial="hidden" animate="show" className="space-y-2">
      <h2 className="font-semibold text-lg text-neutral-90">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pt-1 pb-2">
        {movies.map((m, i) => (
          <MovieCard key={m.id} movie={m} index={i} onPlay={onPlay} />
        ))}
      </div>
    </motion.section>
  )
}
