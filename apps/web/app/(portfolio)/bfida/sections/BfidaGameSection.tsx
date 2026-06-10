"use client"

import { useEffect, useState } from "react"
import { Button } from "@/stories/button/button"
import { BoardToggle } from "../components/BoardToggle"
import { PegBoard } from "../components/PegBoard"
import { RecordScoreForm } from "../components/RecordScoreForm"
import type { BoardKind, Position } from "../lib/boards"
import {
  applyJump,
  findJump,
  isStuck,
  pegsRemaining,
  positionsEqual,
  startingBoard,
} from "../lib/move-logic"
import { formatTime } from "../lib/scores"

type BfidaGameSectionProps = {
  /** Called after a score is successfully recorded, so the leaderboard can refresh. */
  onScoreRecorded?: () => void
}

export function BfidaGameSection({ onScoreRecorded }: BfidaGameSectionProps) {
  const [kind, setKind] = useState<BoardKind>("european")
  const [board, setBoard] = useState(() => startingBoard("european"))
  const [selected, setSelected] = useState<Position | null>(null)
  const [startAt, setStartAt] = useState<number | null>(null)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [, setTick] = useState(0)

  const pegs = pegsRemaining(board)
  const stuck = isStuck(board)
  const won = pegs === 1
  const startingPegs = kind === "english" ? 32 : 36

  // Tick the live timer while a game is in progress (started, not yet ended).
  useEffect(() => {
    if (startAt === null || endAt !== null) return
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [startAt, endAt])

  // Live elapsed for display; the recorded time freezes at the last move.
  const elapsedMs = startAt === null ? 0 : (endAt ?? Date.now()) - startAt
  const timeMs = startAt !== null && endAt !== null ? endAt - startAt : 0

  const handleSwitch = (next: BoardKind) => {
    setKind(next)
    setBoard(startingBoard(next))
    setSelected(null)
    setStartAt(null)
    setEndAt(null)
  }

  const handleReset = () => {
    setBoard(startingBoard(kind))
    setSelected(null)
    setStartAt(null)
    setEndAt(null)
  }

  const handleClick = (pos: Position) => {
    const cell = board.cells[pos[0]]?.[pos[1]]
    if (cell === undefined || cell === "off") return

    if (selected === null) {
      if (cell === "peg") setSelected(pos)
      return
    }

    if (positionsEqual(selected, pos)) {
      setSelected(null)
      return
    }

    if (cell === "peg") {
      setSelected(pos)
      return
    }

    const jump = findJump(board, selected, pos)
    if (!jump) {
      setSelected(null)
      return
    }
    const now = Date.now()
    const nextBoard = applyJump(board, jump)
    setBoard(nextBoard)
    setSelected(null)
    if (startAt === null) setStartAt(now)
    if (isStuck(nextBoard)) setEndAt(now)
  }

  return (
    <section
      id="play"
      className="border-b border-black px-6 sm:px-10 md:px-12 lg:px-20 py-16 md:py-24"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-2 tracking-tight">
              Play it<span className="text-[#bea9e9]">.</span>
            </h2>
            <p className="text-gray-600 max-w-xl">
              Click a marble to select it, then click an empty hole two cells away to jump. The
              jumped-over marble is removed. Try to leave just one.
            </p>
          </div>
          <BoardToggle value={kind} onChange={handleSwitch} />
        </div>

        <div className="grid md:grid-cols-[1fr,minmax(220px,280px)] gap-8 md:gap-12 items-start">
          <div className="rounded-[8px] border border-black bg-white p-4 sm:p-6 md:p-8">
            <PegBoard
              board={board}
              mode="play"
              selected={selected}
              onCellClick={handleClick}
              className="max-w-md mx-auto"
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="border border-black p-5 bg-white">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Pegs remaining</p>
              <p className="text-5xl font-bold text-black font-mono leading-none mb-1">{pegs}</p>
              <p className="text-xs text-gray-500">started with {startingPegs}</p>
            </div>
            <div className="border border-black p-5 bg-white">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Time</p>
              <p className="text-3xl font-bold text-black font-mono leading-none">
                {formatTime(elapsedMs)}
              </p>
            </div>

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full border-black text-black hover:bg-gray-100 rounded-[8px] py-3 text-base font-medium h-auto"
            >
              Reset board
            </Button>

            {won && (
              <div className="border border-[#bea9e9] bg-[#bea9e9]/20 p-4">
                <p className="text-sm font-semibold text-black">1 peg remaining - optimal!</p>
                <p className="text-xs text-gray-700 mt-1">
                  You matched the minimum. Try the other board.
                </p>
              </div>
            )}

            {stuck && !won && (
              <div className="border border-gray-300 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-black">
                  No more moves - {pegs} pegs left.
                </p>
                <p className="text-xs text-gray-600 mt-1">Reset and try a different opening.</p>
              </div>
            )}

            {stuck && (
              <RecordScoreForm
                key={startAt ?? "new"}
                boardKind={kind}
                pegsRemaining={pegs}
                timeMs={timeMs}
                onRecorded={() => onScoreRecorded?.()}
              />
            )}

            {kind === "european" && (
              <p className="text-xs text-gray-500 leading-relaxed">
                Heads up: the 37-hole European board has{" "}
                <span className="text-black font-medium">no single-peg solution</span> from a
                center-empty start - it's a known parity result, not a bug. The best you can do from
                here is two pegs.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
