"use client"

import { motion } from "framer-motion"
import type { Series } from "@/lib/media-api"
import { airingChip } from "./airing-label"
import { cardVariants } from "./motion"
import { PosterImage } from "./poster-image"

export function SeriesCard({
  series,
  index = 0,
  onOpen,
}: {
  series: Series
  index?: number
  onOpen: (s: Series) => void
}) {
  const chip = airingChip(series.airing, Date.now())
  return (
    <motion.button
      type="button"
      variants={cardVariants}
      custom={index}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen(series)}
      className="group w-36 shrink-0 text-left focus:outline-none"
      title={series.title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-10 ring-1 ring-neutral-30 transition group-hover:ring-2 group-hover:ring-neutral-60">
        {series.posterUrl ? (
          <PosterImage src={series.posterUrl} alt={series.title} />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-neutral-70 text-xs">
            {series.title}
          </div>
        )}
        {chip ? (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 font-medium text-[10px] text-white tabular-nums backdrop-blur-sm">
            {chip}
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate font-medium text-neutral-90 text-sm">{series.title}</p>
      {series.year ? <p className="text-neutral-60 text-xs">{series.year}</p> : null}
    </motion.button>
  )
}
