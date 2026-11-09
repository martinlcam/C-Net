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
  type RequestPhase,
  type RequestStatus,
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

const PHASE_STYLE: Record<RequestPhase, { badge: string; text: string }> = {
  waiting: { badge: "bg-neutral-10 text-neutral-70", text: "Waiting" },
  searching: { badge: "bg-sky-50 text-sky-700", text: "Searching" },
  queued: { badge: "bg-sky-50 text-sky-700", text: "Queued" },
  downloading: { badge: "bg-green-50 text-green-700", text: "Downloading" },
  paused: { badge: "bg-yellow-50 text-yellow-800", text: "Paused" },
  stalled: { badge: "bg-yellow-50 text-yellow-800", text: "Stuck" },
  importing: { badge: "bg-green-50 text-green-700", text: "Importing" },
  failed: { badge: "bg-accent-red-10 text-accent-red-70", text: "Failed" },
}

function fmtEta(seconds: number): string {
  if (seconds < 60) return "under a minute left"
  if (seconds < 3600) return `${Math.round(seconds / 60)} min left`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h} h ${m} min left`
}

/** One requested title: a phase badge, what is happening, why, and progress when it moves. */
function RequestStatusRow({ item }: { item: RequestStatus }) {
  const style = PHASE_STYLE[item.phase]
  const moving = item.phase === "downloading" || item.phase === "stalled"
  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-medium text-[11px] ${style.badge}`}
        >
          {style.text}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-90 text-sm">{item.title}</p>
          <p className="text-neutral-70 text-xs">
            {item.label}
            {item.etaSeconds !== null && item.phase === "downloading"
              ? ` · ${fmtEta(item.etaSeconds)}`
              : ""}
          </p>
          {item.detail ? <p className="text-neutral-60 text-xs">{item.detail}</p> : null}
        </div>
      </div>
      {moving && item.progress !== null ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded bg-neutral-10">
          <motion.div
            className={`h-full ${item.phase === "stalled" ? "bg-yellow-500" : "bg-green-600"}`}
            initial={false}
            animate={{ width: `${item.progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      ) : null}
    </li>
  )
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

        {queue.data && queue.data.health.length > 0 ? (
          <div className="mt-4 space-y-1">
            {queue.data.health.map((h) => (
              <p
                key={h.message}
                className={`rounded-md px-3 py-2 text-xs ${
                  h.level === "error"
                    ? "bg-accent-red-10 text-accent-red-70"
                    : "bg-yellow-50 text-yellow-800"
                }`}
              >
                {h.message}
              </p>
            ))}
          </div>
        ) : null}

        {queue.data && queue.data.items.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1 font-semibold text-neutral-70 text-xs uppercase">Requests</p>
            <ul className="divide-y divide-neutral-10">
              {queue.data.items.map((q) => (
                <RequestStatusRow key={`${q.phase}-${q.id}-${q.title}`} item={q} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </DialogShell>
  )
}
