"use client"

import { useQuery } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { useId, useState } from "react"
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
import { Button } from "@/stories/button/button"
import { EpisodeCard } from "./_components/episode-card"
import { MovieCard } from "./_components/movie-card"
import { MovieRow } from "./_components/movie-row"
import { PlayerModal } from "./_components/player-modal"
import { RequestDialog } from "./_components/request-dialog"
import { SeriesCard } from "./_components/series-card"
import { SeriesModal } from "./_components/series-modal"
import { SeriesRow } from "./_components/series-row"

type Tab = "movies" | "tv"

function MovieGenreRow({ genre, onPlay }: { genre: string; onPlay: (m: Movie) => void }) {
  const q = useQuery({ queryKey: ["media", "genre", genre], queryFn: () => getLibrary({ genre }) })
  return <MovieRow title={genre} movies={q.data ?? []} onPlay={onPlay} />
}

function SeriesGenreRow({ genre, onOpen }: { genre: string; onOpen: (s: Series) => void }) {
  const q = useQuery({
    queryKey: ["media", "tv-genre", genre],
    queryFn: () => getSeries({ genre }),
  })
  return <SeriesRow title={genre} series={q.data ?? []} onOpen={onOpen} />
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
    return (
      <div className="flex flex-wrap gap-3">
        {(results.data ?? []).map((m) => (
          <MovieCard key={m.id} movie={m} onPlay={onPlay} />
        ))}
        {results.isFetched && (results.data ?? []).length === 0 ? (
          <p className="text-neutral-60 text-sm">
            Nothing in the library matches “{search}”. Use the Add button to add it.
          </p>
        ) : null}
      </div>
    )
  }
  return (
    <>
      <MovieRow title="Continue Watching" movies={cont.data ?? []} onPlay={onPlay} />
      <MovieRow title="Recently Added" movies={latest.data ?? []} onPlay={onPlay} />
      {(genres.data ?? []).slice(0, 6).map((g) => (
        <MovieGenreRow key={g} genre={g} onPlay={onPlay} />
      ))}
      {!cont.isLoading && !latest.isLoading && (latest.data ?? []).length === 0 ? (
        <p className="text-neutral-60 text-sm">
          No movies yet. Use the Add button to add your first one.
        </p>
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
    return (
      <div className="flex flex-wrap gap-3">
        {(results.data ?? []).map((s) => (
          <SeriesCard key={s.id} series={s} onOpen={onOpenSeries} />
        ))}
        {results.isFetched && (results.data ?? []).length === 0 ? (
          <p className="text-neutral-60 text-sm">
            Nothing matches “{search}”. Use the Add button to add it.
          </p>
        ) : null}
      </div>
    )
  }
  return (
    <>
      {(cont.data ?? []).length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold text-lg text-neutral-90">Continue Watching</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(cont.data ?? []).map((ep) => (
              <EpisodeCard key={ep.id} episode={ep} onPlay={onPlayEpisode} />
            ))}
          </div>
        </section>
      ) : null}
      <SeriesRow title="Recently Added" series={latest.data ?? []} onOpen={onOpenSeries} />
      {(genres.data ?? []).slice(0, 6).map((g) => (
        <SeriesGenreRow key={g} genre={g} onOpen={onOpenSeries} />
      ))}
      {!latest.isLoading && (latest.data ?? []).length === 0 ? (
        <p className="text-neutral-60 text-sm">
          No shows yet. Use the Add button to add your first one.
        </p>
      ) : null}
    </>
  )
}

export default function MediaPage() {
  const [tab, setTab] = useState<Tab>("movies")
  const [playing, setPlaying] = useState<Playable | null>(null)
  const [openSeries, setOpenSeries] = useState<Series | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [query, setQuery] = useState("")
  const searchId = useId()

  const tabClass = (t: Tab) =>
    `rounded-md px-3 py-1 font-medium text-sm ${
      tab === t ? "bg-neutral-90 text-white" : "bg-neutral-10 text-neutral-70 hover:bg-neutral-30"
    }`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-2xl text-neutral-90">Media</h1>
          <div className="flex gap-1">
            <button type="button" className={tabClass("movies")} onClick={() => setTab("movies")}>
              Movies
            </button>
            <button type="button" className={tabClass("tv")} onClick={() => setTab("tv")}>
              TV
            </button>
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
              className="w-48 rounded-md border border-neutral-30 bg-white py-2 pr-2 pl-8 text-sm outline-none focus:border-neutral-60 sm:w-64"
            />
          </div>
          <Button onClick={() => setRequesting(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {tab === "movies" ? (
        <MoviesView onPlay={setPlaying} search={query} />
      ) : (
        <TvView onPlayEpisode={setPlaying} onOpenSeries={setOpenSeries} search={query} />
      )}

      {openSeries ? (
        <SeriesModal
          series={openSeries}
          onClose={() => setOpenSeries(null)}
          onPlay={(ep) => setPlaying(ep)}
        />
      ) : null}
      {playing ? <PlayerModal item={playing} onClose={() => setPlaying(null)} /> : null}
      {requesting ? <RequestDialog initialMode={tab} onClose={() => setRequesting(false)} /> : null}
    </div>
  )
}
