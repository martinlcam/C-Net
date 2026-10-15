"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { Plus, Search } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import {
  type Episode,
  getContinue,
  getGenres,
  getLatest,
  getLibrary,
  getSeries,
  getTvContinue,
  getTvGenres,
  getTvLatest,
  type Movie,
  type Playable,
  type Series,
} from "@/lib/media-api"
import { useMediaViewStore } from "@/lib/stores/media-view"
import { Button } from "@/stories/button/button"
import { EpisodeCard } from "./_components/episode-card"
import { rowVariants, spring, viewVariants } from "./_components/motion"
import { MovieCard } from "./_components/movie-card"
import { MovieRow } from "./_components/movie-row"
import { PlayerModal } from "./_components/player-modal"
import { RequestDialog } from "./_components/request-dialog"
import { SeriesCard } from "./_components/series-card"
import { SeriesModal } from "./_components/series-modal"
import { SeriesRow } from "./_components/series-row"
import { GridSkeleton, RowSkeleton } from "./_components/skeletons"

type Tab = "movies" | "tv"

const TABS: { id: Tab; label: string }[] = [
  { id: "movies", label: "Movies" },
  { id: "tv", label: "TV" },
]

function MovieGenreRow({ genre, onPlay }: { genre: string; onPlay: (m: Movie) => void }) {
  const q = useQuery({ queryKey: ["media", "genre", genre], queryFn: () => getLibrary({ genre }) })
  return <MovieRow title={genre} movies={q.data ?? []} loading={q.isPending} onPlay={onPlay} />
}

function SeriesGenreRow({ genre, onOpen }: { genre: string; onOpen: (s: Series) => void }) {
  const q = useQuery({
    queryKey: ["media", "tv-genre", genre],
    queryFn: () => getSeries({ genre }),
  })
  return <SeriesRow title={genre} series={q.data ?? []} loading={q.isPending} onOpen={onOpen} />
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <motion.p
      variants={viewVariants}
      initial="hidden"
      animate="show"
      className="text-neutral-60 text-sm"
    >
      {children}
    </motion.p>
  )
}

function MoviesView({ onPlay, search }: { onPlay: (m: Movie) => void; search: string }) {
  const searching = search.trim().length > 0
  const cont = useQuery({ queryKey: ["media", "continue"], queryFn: getContinue })
  const latest = useQuery({ queryKey: ["media", "latest"], queryFn: getLatest })
  const genres = useQuery({ queryKey: ["media", "genres"], queryFn: getGenres })
  const results = useQuery({
    queryKey: ["media", "search", search],
    queryFn: () => getLibrary({ search }),
    enabled: searching,
  })

  if (searching) {
    const hits = results.data ?? []
    if (results.isPending) return <GridSkeleton />
    if (hits.length === 0) {
      return (
        <EmptyNote>
          Nothing in the library matches “{search}”. Use the Add button to add it.
        </EmptyNote>
      )
    }
    return (
      <motion.div
        key={search}
        variants={rowVariants}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-3 pt-1"
      >
        {hits.map((m, i) => (
          <MovieCard key={m.id} movie={m} index={i} onPlay={onPlay} />
        ))}
      </motion.div>
    )
  }

  const settled = !cont.isPending && !latest.isPending
  return (
    <>
      <MovieRow
        title="Continue Watching"
        movies={cont.data ?? []}
        loading={cont.isPending}
        onPlay={onPlay}
      />
      <MovieRow
        title="Recently Added"
        movies={latest.data ?? []}
        loading={latest.isPending}
        onPlay={onPlay}
      />
      {genres.isPending ? <RowSkeleton /> : null}
      {(genres.data ?? []).map((g) => (
        <MovieGenreRow key={g} genre={g} onPlay={onPlay} />
      ))}
      {settled && (latest.data ?? []).length === 0 ? (
        <EmptyNote>No movies yet. Use the Add button to add your first one.</EmptyNote>
      ) : null}
    </>
  )
}

function TvView({
  onPlayEpisode,
  onOpenSeries,
  search,
}: {
  onPlayEpisode: (e: Episode) => void
  onOpenSeries: (s: Series) => void
  search: string
}) {
  const searching = search.trim().length > 0
  const cont = useQuery({ queryKey: ["media", "tv-continue"], queryFn: getTvContinue })
  const latest = useQuery({ queryKey: ["media", "tv-latest"], queryFn: getTvLatest })
  const genres = useQuery({ queryKey: ["media", "tv-genres"], queryFn: getTvGenres })
  const results = useQuery({
    queryKey: ["media", "tv-search", search],
    queryFn: () => getSeries({ search }),
    enabled: searching,
  })

  if (searching) {
    const hits = results.data ?? []
    if (results.isPending) return <GridSkeleton />
    if (hits.length === 0) {
      return <EmptyNote>Nothing matches “{search}”. Use the Add button to add it.</EmptyNote>
    }
    return (
      <motion.div
        key={search}
        variants={rowVariants}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-3 pt-1"
      >
        {hits.map((s, i) => (
          <SeriesCard key={s.id} series={s} index={i} onOpen={onOpenSeries} />
        ))}
      </motion.div>
    )
  }

  const continuing = cont.data ?? []
  return (
    <>
      {cont.isPending ? <RowSkeleton wide count={5} /> : null}
      {continuing.length > 0 ? (
        <motion.section
          variants={rowVariants}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          <h2 className="font-semibold text-lg text-neutral-90">Continue Watching</h2>
          <div className="flex gap-3 overflow-x-auto pt-1 pb-2">
            {continuing.map((ep, i) => (
              <EpisodeCard key={ep.id} episode={ep} index={i} onPlay={onPlayEpisode} />
            ))}
          </div>
        </motion.section>
      ) : null}
      <SeriesRow
        title="Recently Added"
        series={latest.data ?? []}
        loading={latest.isPending}
        onOpen={onOpenSeries}
      />
      {genres.isPending ? <RowSkeleton /> : null}
      {(genres.data ?? []).map((g) => (
        <SeriesGenreRow key={g} genre={g} onOpen={onOpenSeries} />
      ))}
      {!latest.isPending && (latest.data ?? []).length === 0 ? (
        <EmptyNote>No shows yet. Use the Add button to add your first one.</EmptyNote>
      ) : null}
    </>
  )
}

export default function MediaPage() {
  const [tab, setTab] = useState<Tab>("movies")
  // The player plays a queue so it can auto-advance to the next episode.
  const [queue, setQueue] = useState<Playable[] | null>(null)
  const [startIndex, setStartIndex] = useState(0)
  const [openSeries, setOpenSeries] = useState<Series | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [query, setQuery] = useState("")
  const searchId = useId()

  // Hide the bottom-right transfers widget while a title is open for viewing
  // (player or series detail modal). Transfers keep running in the background.
  const setViewing = useMediaViewStore((s) => s.setViewing)
  const viewing = Boolean(queue || openSeries)
  useEffect(() => {
    setViewing(viewing)
    return () => setViewing(false)
  }, [viewing, setViewing])

  const playSingle = (p: Playable) => {
    setStartIndex(0)
    setQueue([p])
  }
  const playEpisode = (ep: Episode, episodes: Episode[]) => {
    const i = Math.max(
      0,
      episodes.findIndex((e) => e.id === ep.id)
    )
    setStartIndex(i)
    setQueue(episodes)
  }

  const searching = query.trim().length > 0

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-2xl text-neutral-90">Media</h1>
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`relative rounded-md px-3 py-1 font-medium text-sm transition-colors ${
                    tab === t.id
                      ? "text-white"
                      : "bg-neutral-10 text-neutral-70 hover:bg-neutral-30"
                  }`}
                >
                  {tab === t.id ? (
                    <motion.span
                      layoutId="media-tab-pill"
                      transition={spring}
                      className="absolute inset-0 rounded-md bg-neutral-90"
                    />
                  ) : null}
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-neutral-60" />
              <input
                id={searchId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${tab === "movies" ? "movies" : "shows"}…`}
                className="w-48 rounded-md border border-neutral-30 bg-white py-2 pr-2 pl-8 text-sm outline-none transition-colors focus:border-neutral-60 sm:w-64"
              />
            </div>
            <Button onClick={() => setRequesting(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        {/* Tab and browse/search swaps crossfade; rows inside stagger in on their own. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${tab}:${searching ? "search" : "browse"}`}
            variants={viewVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-6"
          >
            {tab === "movies" ? (
              <MoviesView onPlay={playSingle} search={query} />
            ) : (
              <TvView onPlayEpisode={playSingle} onOpenSeries={setOpenSeries} search={query} />
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {openSeries ? (
            <SeriesModal
              key={openSeries.id}
              series={openSeries}
              escapeEnabled={!queue}
              onClose={() => setOpenSeries(null)}
              onPlay={playEpisode}
            />
          ) : null}
        </AnimatePresence>
        {queue ? (
          <PlayerModal queue={queue} startIndex={startIndex} onClose={() => setQueue(null)} />
        ) : null}
        <AnimatePresence>
          {requesting ? (
            <RequestDialog key="request" initialMode={tab} onClose={() => setRequesting(false)} />
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
