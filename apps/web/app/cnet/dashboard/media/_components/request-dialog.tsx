"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Search, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import {
  discover,
  discoverTv,
  getQueue,
  getTvQueue,
  requestMovie,
  requestSeries,
} from "@/lib/media-api"
import { Button } from "@/stories/button/button"
import { DialogShell } from "./dialog-shell"
import { cardVariants, rowVariants, spring, viewVariants } from "./motion"
import { ResultListSkeleton } from "./skeletons"

type Mode = "movies" | "tv"

type Row = {
  key: string | number
  title: string
  year: number
  overview?: string
  posterUrl?: string
  already: boolean
  add: () => Promise<{ ok: boolean; message?: string }>
}

function ResultRow({ row, index }: { row: Row; index: number }) {
  const [done, setDone] = useState<string | null>(null)
  const mut = useMutation({
    mutationFn: row.add,
    onSuccess: (res) => setDone(res.ok ? "Added" : res.message || "Unavailable"),
    onError: (e: Error) => setDone(e.message),
  })
  return (
    <motion.div
      variants={cardVariants}
      custom={index}
      className="flex gap-3 border-neutral-10 border-b py-2"
    >
      {row.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        // biome-ignore lint/performance/noImgElement: media posters are remote API URLs; next/image would need env-dependent remotePatterns
        <img src={row.posterUrl} alt={row.title} className="h-24 w-16 rounded object-cover" />
      ) : (
        <div className="h-24 w-16 rounded bg-neutral-10" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-neutral-90 text-sm">
          {row.title} {row.year ? <span className="text-neutral-60">({row.year})</span> : null}
        </p>
        <p className="line-clamp-2 text-neutral-60 text-xs">{row.overview}</p>
      </div>
      <div className="flex shrink-0 items-center">
        {row.already ? (
          <span className="text-green-600 text-xs">In library</span>
        ) : done ? (
          <span className="text-neutral-60 text-xs">{done}</span>
        ) : (
          <Button variant="ghost" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export function RequestDialog({
  initialMode,
  onClose,
}: {
  initialMode: Mode
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [term, setTerm] = useState("")
  const [submitted, setSubmitted] = useState("")
  const searchId = useId()
  // The dialog exists to type a search, so land focus in the box (before the shell
  // falls back to focusing its panel).
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const results = useQuery({
    queryKey: ["media", "discover", mode, submitted],
    queryFn: async (): Promise<Row[]> => {
      if (mode === "movies") {
        const r = await discover(submitted)
        return r.map((m) => ({
          key: m.tmdbId,
          title: m.title,
          year: m.year,
          overview: m.overview,
          posterUrl: m.posterUrl,
          already: m.inLibrary || m.hasFile,
          add: () => requestMovie(m.tmdbId),
        }))
      }
      const r = await discoverTv(submitted)
      return r.map((s) => ({
        key: s.tvdbId,
        title: s.title,
        year: s.year,
        overview: s.overview,
        posterUrl: s.posterUrl,
        already: s.inLibrary,
        add: () => requestSeries(s.tvdbId),
      }))
    },
    enabled: submitted.trim().length > 1,
  })

  const queue = useQuery({
    queryKey: ["media", "queue", mode],
    queryFn: () => (mode === "movies" ? getQueue() : getTvQueue()),
    refetchInterval: 5000,
  })

  const modes: { id: Mode; label: string }[] = [
    { id: "movies", label: "Movies" },
    { id: "tv", label: "TV Shows" },
  ]

  return (
    <DialogShell
      label="Add to library"
      onClose={onClose}
      backdropClassName="items-start bg-black/60 p-4 sm:p-10"
      className="flex max-h-full w-full max-w-2xl flex-col rounded-lg bg-white p-4 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-lg text-neutral-90">Add to library</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 transition-colors hover:bg-neutral-10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-3 flex gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`relative rounded-md px-3 py-1 text-sm transition-colors ${
              mode === m.id ? "text-white" : "bg-neutral-10 text-neutral-70 hover:bg-neutral-30"
            }`}
          >
            {mode === m.id ? (
              <motion.span
                layoutId="request-mode-pill"
                transition={spring}
                className="absolute inset-0 rounded-md bg-neutral-90"
              />
            ) : null}
            <span className="relative z-10">{m.label}</span>
          </button>
        ))}
      </div>

      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(term)
        }}
      >
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-neutral-60" />
          <input
            id={searchId}
            value={term}
            ref={searchRef}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Search for a ${mode === "movies" ? "movie" : "TV show"} to add…`}
            className="w-full rounded-md border border-neutral-30 bg-white py-2 pr-2 pl-8 text-sm outline-none focus:border-neutral-60"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {results.isFetching ? (
            <motion.div
              key="searching"
              variants={viewVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <ResultListSkeleton />
            </motion.div>
          ) : results.data && results.data.length > 0 ? (
            <motion.div
              key={`${mode}:${submitted}`}
              variants={rowVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              {results.data.map((row, i) => (
                <ResultRow key={row.key} row={row} index={i} />
              ))}
            </motion.div>
          ) : submitted ? (
            <motion.p
              key="empty"
              variants={viewVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="py-4 text-center text-neutral-60 text-sm"
            >
              No matches.
            </motion.p>
          ) : null}
        </AnimatePresence>

        {queue.data && queue.data.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1 font-semibold text-neutral-70 text-xs uppercase">Downloading</p>
            {queue.data.map((q) => (
              <div
                key={`${q.id}-${q.title}`}
                className="flex justify-between py-1 text-neutral-90 text-sm"
              >
                <span className="truncate">{q.title}</span>
                <span className="shrink-0 text-neutral-60">{q.progress}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </DialogShell>
  )
}
