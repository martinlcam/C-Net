"use client"

import { mediaUrl, type Series } from "@/lib/media-api"

export function SeriesCard({ series, onOpen }: { series: Series; onOpen: (s: Series) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(series)}
      className="group w-36 shrink-0 text-left focus:outline-none"
      title={series.title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-neutral-10 ring-1 ring-neutral-30 transition group-hover:ring-2 group-hover:ring-neutral-60">
        {series.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          // biome-ignore lint/performance/noImgElement: media posters are remote API URLs; next/image would need env-dependent remotePatterns
          <img
            src={mediaUrl(series.posterUrl)}
            alt={series.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-neutral-70 text-xs">
            {series.title}
          </div>
        )}
      </div>
      <p className="mt-1 truncate font-medium text-neutral-90 text-sm">{series.title}</p>
      {series.year ? <p className="text-neutral-60 text-xs">{series.year}</p> : null}
    </button>
  )
}
