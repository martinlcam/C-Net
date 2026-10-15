"use client"

import { motion } from "framer-motion"
import type { Series } from "@/lib/media-api"
import { rowVariants } from "./motion"
import { SeriesCard } from "./series-card"
import { RowSkeleton } from "./skeletons"

export function SeriesRow({
  title,
  series,
  loading = false,
  onOpen,
}: {
  title: string
  series: Series[]
  loading?: boolean
  onOpen: (s: Series) => void
}) {
  if (series.length === 0) return loading ? <RowSkeleton /> : null
  return (
    <motion.section variants={rowVariants} initial="hidden" animate="show" className="space-y-2">
      <h2 className="font-semibold text-lg text-neutral-90">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pt-1 pb-2">
        {series.map((s, i) => (
          <SeriesCard key={s.id} series={s} index={i} onOpen={onOpen} />
        ))}
      </div>
    </motion.section>
  )
}
