"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Play, X } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type Episode,
  getEpisodes,
  getSeasons,
  type Series,
  TICKS_PER_SECOND,
} from "@/lib/media-api"
import { DialogShell } from "./dialog-shell"
import { cardVariants, rowVariants, viewVariants } from "./motion"
import { PosterImage } from "./poster-image"
import { SeasonPicker } from "./season-picker"
import { EpisodeListSkeleton } from "./skeletons"

function episodeProgress(ep: Episode): number {
  if (ep.playedPercentage && ep.playedPercentage > 0) return Math.min(100, ep.playedPercentage)
  if (ep.resumePositionTicks > 0 && ep.runtimeMinutes) {
    const watchedMin = ep.resumePositionTicks / TICKS_PER_SECOND / 60
    return Math.min(100, (watchedMin / ep.runtimeMinutes) * 100)
  }
  return 0
}

function EpisodeRow({
  ep,
  index,
  onPlay,
}: {
  ep: Episode
  index: number
  onPlay: (e: Episode) => void
}) {
  const pct = episodeProgress(ep)
  return (
    <motion.button
      type="button"
      variants={cardVariants}
      custom={index}
      whileTap={{ scale: 0.99 }}
      onClick={() => onPlay(ep)}
      className="group flex w-full gap-3 border-neutral-10 border-b p-2 text-left transition-colors hover:bg-neutral-10"
    >
      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded bg-neutral-10 sm:w-32">
        {ep.posterUrl ? <PosterImage src={ep.posterUrl} alt={ep.title} /> : null}
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          <Play className="h-7 w-7 text-white" />
        </span>
        {pct > 0 && pct < 100 ? (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-neutral-90 text-sm">
            {ep.episodeNumber != null ? `${ep.episodeNumber}. ` : ""}
            {ep.title}
            {ep.played ? <Check className="ml-1 inline h-3 w-3 text-green-600" /> : null}
          </p>
          {ep.runtimeMinutes ? (
            <span className="shrink-0 text-neutral-60 text-xs">{ep.runtimeMinutes}m</span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-neutral-60 text-xs">{ep.overview}</p>
      </div>
    </motion.button>
  )
}

export function SeriesModal({
  series,
  escapeEnabled = true,
  onClose,
  onPlay,
}: {
  series: Series
  /** False while the player is open on top, so Escape closes the player and not this. */
  escapeEnabled?: boolean
  onClose: () => void
  onPlay: (e: Episode, episodes: Episode[]) => void
}) {
  const seasons = useQuery({
    queryKey: ["media", "seasons", series.id],
    queryFn: () => getSeasons(series.id),
  })
  const [seasonId, setSeasonId] = useState<string | null>(null)

  useEffect(() => {
    if (!seasonId && seasons.data && seasons.data.length > 0) setSeasonId(seasons.data[0].id)
  }, [seasons.data, seasonId])

  const episodes = useQuery({
    queryKey: ["media", "episodes", series.id, seasonId],
    queryFn: () => getEpisodes(series.id, seasonId as string),
    enabled: Boolean(seasonId),
  })

  const art = series.posterUrl ?? series.backdropUrl
  const epList = episodes.data ?? []
  // Skeleton until the seasons are known and the chosen season's episodes have landed.
  const loading = seasons.isPending || (seasonId !== null && episodes.isPending)
  const meta = [
    series.year ? String(series.year) : null,
    series.seasonCount ? `${series.seasonCount} season${series.seasonCount > 1 ? "s" : ""}` : null,
    series.officialRating || null,
    series.communityRating ? `★ ${series.communityRating.toFixed(1)}` : null,
  ].filter(Boolean)

  return (
    <DialogShell
      label={series.title}
      onClose={onClose}
      escapeEnabled={escapeEnabled}
      backdropClassName="items-center p-3 sm:p-8"
      className="relative flex h-full max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:flex-row"
    >
      {/* Left: artwork + description. Stacked on a phone it collapses to a compact
          header with its own close button, so the episode list gets the height. */}
      <div className="shrink-0 bg-neutral-90 text-white sm:max-h-[88vh] sm:w-80 sm:overflow-y-auto">
        <div className="flex gap-3 p-3 sm:hidden">
          <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded bg-neutral-80">
            {art ? <PosterImage src={art} alt={series.title} tone="dark" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{series.title}</h2>
            {meta.length > 0 ? (
              <p className="mt-0.5 text-white/60 text-xs">{meta.join(" · ")}</p>
            ) : null}
            {series.overview ? (
              <p className="mt-1 line-clamp-2 text-white/70 text-xs">{series.overview}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="self-start rounded-full bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hidden sm:block">
          <div className="relative aspect-[2/3] w-full bg-neutral-80">
            {art ? <PosterImage src={art} alt={series.title} tone="dark" /> : null}
          </div>
          <div className="p-4">
            <h2 className="font-semibold text-lg">{series.title}</h2>
            {meta.length > 0 ? (
              <p className="mt-1 text-white/60 text-xs">{meta.join(" · ")}</p>
            ) : null}
            {(series.genres?.length ?? 0) > 0 ? (
              <p className="mt-2 text-white/70 text-xs">{series.genres.join(", ")}</p>
            ) : null}
            {series.overview ? (
              <p className="mt-3 text-sm text-white/80 leading-relaxed">{series.overview}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right: season selector + scrollable episode list */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-neutral-90">Episodes</h3>
          <div className="flex items-center gap-2">
            {(seasons.data ?? []).length > 0 ? (
              <SeasonPicker seasons={seasons.data ?? []} value={seasonId} onChange={setSeasonId} />
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="hidden rounded-full bg-neutral-20 p-1.5 text-neutral-70 transition-colors hover:bg-neutral-30 hover:text-neutral-90 sm:inline-flex"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <motion.div
                key="loading"
                variants={viewVariants}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <EpisodeListSkeleton />
              </motion.div>
            ) : epList.length === 0 ? (
              <motion.p
                key="empty"
                variants={viewVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="py-4 text-center text-neutral-60 text-sm"
              >
                No episodes available yet.
              </motion.p>
            ) : (
              <motion.div
                key={seasonId}
                variants={rowVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                {epList.map((ep, i) => (
                  <EpisodeRow key={ep.id} ep={ep} index={i} onPlay={(e) => onPlay(e, epList)} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DialogShell>
  )
}
