import { cn } from "@/lib/utils"

type Tone = "light" | "dark"

// Stable keys for placeholder slots — they never reorder, so index-derived ids are fine.
const SLOTS = Array.from({ length: 16 }, (_, i) => `slot-${i}`)

const block = (tone: Tone) => (tone === "dark" ? "bg-white/10" : "bg-neutral-20")

export function Skeleton({ className, tone = "light" }: { className?: string; tone?: Tone }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md", block(tone), className)} />
}

/** Mirrors MovieCard / SeriesCard (`wide` mirrors the 16:9 EpisodeCard). */
export function PosterCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn("shrink-0", wide ? "w-48" : "w-36")}>
      <Skeleton className={wide ? "aspect-video" : "aspect-[2/3]"} />
      <Skeleton className="mt-2 h-3.5 w-3/4" />
      <Skeleton className="mt-1.5 h-3 w-1/3" />
    </div>
  )
}

export function RowSkeleton({ count = 8, wide = false }: { count?: number; wide?: boolean }) {
  return (
    <section className="space-y-2" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-3 overflow-hidden pb-2">
        {SLOTS.slice(0, count).map((id) => (
          <PosterCardSkeleton key={id} wide={wide} />
        ))}
      </div>
    </section>
  )
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-3" aria-busy="true">
      {SLOTS.slice(0, count).map((id) => (
        <PosterCardSkeleton key={id} />
      ))}
    </div>
  )
}

/** Mirrors the EpisodeRow in the series modal (light) and the in-player panel (dark). */
export function EpisodeListSkeleton({
  count = 6,
  tone = "light",
}: {
  count?: number
  tone?: Tone
}) {
  return (
    <div className="space-y-1" aria-busy="true">
      {SLOTS.slice(0, count).map((id) => (
        <div key={id} className="flex gap-3 p-2">
          <Skeleton
            tone={tone}
            className={cn("aspect-video shrink-0", tone === "dark" ? "w-28" : "w-32")}
          />
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton tone={tone} className="h-3.5 w-1/2" />
              <Skeleton tone={tone} className="h-3 w-8" />
            </div>
            <Skeleton tone={tone} className="mt-2 h-3 w-full" />
            <Skeleton tone={tone} className="mt-1.5 h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mirrors ResultRow in the add dialog. */
export function ResultListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-busy="true">
      {SLOTS.slice(0, count).map((id) => (
        <div key={id} className="flex gap-3 border-neutral-10 border-b py-2">
          <Skeleton className="h-24 w-16 rounded" />
          <div className="min-w-0 flex-1 py-1">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-3/4" />
          </div>
          <div className="flex shrink-0 items-center">
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
