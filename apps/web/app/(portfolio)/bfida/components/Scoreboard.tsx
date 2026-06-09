"use client"

import { useEffect, useState } from "react"
import type { BoardKind } from "../lib/boards"
import { fetchScores, formatTime, type ScoreEntry } from "../lib/scores"
import { BoardToggle } from "./BoardToggle"

type ScoreboardProps = {
  /** Bumping this re-fetches (e.g. after a new score is recorded). */
  refreshKey?: number
  initialBoard?: BoardKind
}

type Status = "loading" | "ready" | "error"

export function Scoreboard({ refreshKey = 0, initialBoard = "european" }: ScoreboardProps) {
  const [board, setBoard] = useState<BoardKind>(initialBoard)
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [status, setStatus] = useState<Status>("loading")

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is a deliberate refetch trigger, not read inside the effect
  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    fetchScores(board)
      .then((rows) => {
        if (cancelled) return
        setScores(rows)
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [board, refreshKey])

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h3 className="text-3xl font-bold text-black tracking-tight">
          Leaderboard<span className="text-[#bea9e9]">.</span>
        </h3>
        <BoardToggle value={board} onChange={setBoard} />
      </div>

      {status === "loading" && <p className="text-sm text-gray-500">Loading scores…</p>}
      {status === "error" && (
        <p className="text-sm text-gray-500">Couldn't load the leaderboard right now.</p>
      )}
      {status === "ready" && scores.length === 0 && (
        <p className="text-sm text-gray-500">No scores yet — finish a game and be the first.</p>
      )}
      {status === "ready" && scores.length > 0 && (
        <div>
          <div className="flex items-center gap-4 pb-2 border-b border-black text-[10px] uppercase tracking-wider text-gray-500">
            <span className="w-6 shrink-0">#</span>
            <span className="flex-1">Player</span>
            <span className="w-16 text-right shrink-0">Pegs left</span>
            <span className="w-16 text-right shrink-0">Time</span>
          </div>
          <ol className="flex flex-col">
            {scores.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-4 py-2.5 border-b border-gray-200 last:border-b-0"
              >
                <span className="w-6 text-sm font-mono text-gray-400 shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-black truncate">
                  {s.firstName} {s.lastInitial}.
                </span>
                <span className="w-16 text-right text-sm font-mono font-bold text-black shrink-0">
                  {s.pegsRemaining}
                </span>
                <span className="w-16 text-right text-sm font-mono text-gray-600 shrink-0">
                  {formatTime(s.timeMs)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
