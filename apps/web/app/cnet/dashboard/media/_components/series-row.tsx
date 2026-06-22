"use client"

import type { Series } from "@/lib/media-api"
import { SeriesCard } from "./series-card"

export function SeriesRow({
  title,
  series,
  onOpen,
}: {
  title: string
  series: Series[]
  onOpen: (s: Series) => void
}) {
  if (series.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-lg text-neutral-90">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {series.map((s) => (
          <SeriesCard key={s.id} series={s} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
