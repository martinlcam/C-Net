"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef, useState } from "react"
import type { BoardKind } from "../lib/boards"
import { fetchScoresPage, formatTime } from "../lib/scores"
import { BoardToggle } from "./BoardToggle"

type ScoreboardProps = {
  /** Bumping this re-fetches from page 0 (e.g. after a new score is recorded). */
  refreshKey?: number
  initialBoard?: BoardKind
}

const PAGE_SIZE = 25
/** Cap the viewport so the leaderboard never grows unbounded; it scrolls past this. */
const LIST_MAX_HEIGHT = 420
/** Estimated row height; rows self-measure once rendered. */
const ROW_HEIGHT = 45
// Per-row padding so text is inset while row separators reach the section's vertical rules.
const ROW_X = "px-6 sm:px-10 md:px-12"

export function Scoreboard({ refreshKey = 0, initialBoard = "european" }: ScoreboardProps) {
  const [board, setBoard] = useState<BoardKind>(initialBoard)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["bfida", "scores", board, refreshKey],
      queryFn: ({ pageParam }) => fetchScoresPage(board, pageParam, PAGE_SIZE),
      initialPageParam: 0,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  const scores = data?.pages.flatMap((p) => p.data) ?? []
  // One extra virtual row acts as the loader/sentinel when more pages exist.
  const rowCount = hasNextPage ? scores.length + 1 : scores.length

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })
  const virtualItems = virtualizer.getVirtualItems()

  // Fetch the next page once the sentinel row scrolls into view.
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1]
    if (!last) return
    if (last.index >= scores.length && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [virtualItems, scores.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="w-full">
      <div
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 ${ROW_X}`}
      >
        <h3 className="text-3xl font-bold text-black tracking-tight">
          Leaderboard<span className="text-[#bea9e9]">.</span>
        </h3>
        <BoardToggle value={board} onChange={setBoard} />
      </div>

      <div
        className={`flex items-center gap-4 pb-2 text-[10px] uppercase tracking-wider text-gray-500 ${ROW_X}`}
      >
        <span className="w-6 shrink-0">#</span>
        <span className="flex-1">Player</span>
        <span className="w-20 text-right shrink-0">Pegs left</span>
        <span className="w-16 text-right shrink-0">Time</span>
      </div>

      {isLoading ? (
        <p className={`text-sm text-gray-500 py-3 ${ROW_X}`}>Loading scores…</p>
      ) : error ? (
        <p className={`text-sm text-gray-500 py-3 ${ROW_X}`}>
          Couldn't load the leaderboard right now.
        </p>
      ) : scores.length === 0 ? (
        <p className={`text-sm text-gray-500 py-3 ${ROW_X}`}>
          No scores yet — finish a game and be the first.
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-auto"
          style={{ maxHeight: LIST_MAX_HEIGHT, scrollbarGutter: "stable" }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualItems.map((vr) => {
              const isSentinel = vr.index >= scores.length
              const s = scores[vr.index]
              return (
                <div
                  key={vr.key}
                  data-index={vr.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  {isSentinel ? (
                    <div className={`py-3 text-center text-xs text-gray-400 ${ROW_X}`}>
                      {isFetchingNextPage ? "Loading…" : "Scroll for more…"}
                    </div>
                  ) : s ? (
                    <div
                      className={`flex items-center gap-4 py-2.5 border-b border-gray-200 ${ROW_X}`}
                    >
                      <span className="w-6 text-sm font-mono text-gray-400 shrink-0">
                        {vr.index + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-black truncate">
                        {s.firstName} {s.lastInitial}.
                      </span>
                      <span className="w-20 text-right text-sm font-mono font-bold text-black shrink-0">
                        {s.pegsRemaining}
                      </span>
                      <span className="w-16 text-right text-sm font-mono text-gray-600 shrink-0">
                        {formatTime(s.timeMs)}
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
