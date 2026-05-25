"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/stories/button/button"
import { AlgorithmStats } from "../components/AlgorithmStats"
import { BoardToggle } from "../components/BoardToggle"
import { PegBoard } from "../components/PegBoard"
import { PseudocodePanel } from "../components/PseudocodePanel"
import { type Board, type BoardKind, type Cell, type Position, makeBoard } from "../lib/boards"
import { applyJump } from "../lib/move-logic"
import { SOLUTIONS } from "../lib/solutions"
import { buildTrace } from "../lib/algorithm-trace"

function buildInitialBoard(kind: BoardKind): Board {
  const sol = SOLUTIONS[kind]
  const board = makeBoard(kind)
  if (sol.emptyAt[0] === 3 && sol.emptyAt[1] === 3) return board
  // Move the empty hole from (3,3) to sol.emptyAt
  const next: Cell[][] = board.cells.map((row) => row.slice())
  if (next[3]) (next[3] as Cell[])[3] = "peg"
  const [er, ec] = sol.emptyAt
  if (next[er]) (next[er] as Cell[])[ec] = "hole"
  return { ...board, cells: next }
}

const TICK_MS = 650

export function BfidaSolverSection() {
  const [kind, setKind] = useState<BoardKind>("english")
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const solution = SOLUTIONS[kind]
  const trace = useMemo(() => buildTrace(kind), [kind])
  const totalSteps = trace.length

  // Derive board state up to current step index by replaying jumps 0..currentJump.
  const board = useMemo(() => {
    let b = buildInitialBoard(kind)
    const upTo = stepIdx
    for (let i = 0; i <= upTo && i < trace.length; i++) {
      const step = trace[i]
      if (step && step.jumpIndex !== null) {
        const j = solution.jumps[step.jumpIndex]
        if (j) b = applyJump(b, j)
      }
    }
    return b
  }, [kind, stepIdx, trace, solution])

  const currentStep = trace[Math.min(stepIdx, totalSteps - 1)]
  const upcomingJump =
    currentStep && currentStep.jumpIndex !== null
      ? solution.jumps[currentStep.jumpIndex] ?? null
      : null

  useEffect(() => {
    if (!playing) return
    if (stepIdx >= totalSteps - 1) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setStepIdx((i) => Math.min(i + 1, totalSteps - 1)), TICK_MS / speed)
    return () => clearTimeout(id)
  }, [playing, stepIdx, totalSteps, speed])

  const handleSwitch = (next: BoardKind) => {
    setKind(next)
    setStepIdx(0)
    setPlaying(false)
  }

  const handlePlayPause = () => {
    if (stepIdx >= totalSteps - 1) {
      setStepIdx(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }

  const handleStep = (delta: number) => {
    setPlaying(false)
    setStepIdx((i) => Math.max(0, Math.min(totalSteps - 1, i + delta)))
  }

  const handleReset = () => {
    setPlaying(false)
    setStepIdx(0)
  }

  if (!currentStep) return null

  const isFinalStep = stepIdx === totalSteps - 1
  const jumpDisplay = currentStep.jumpIndex !== null ? currentStep.jumpIndex + 1 : "—"

  return (
    <section
      id="solver"
      className="border-b border-black px-6 sm:px-10 md:px-12 lg:px-20 py-16 md:py-24 bg-[#FAF6F1]"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-4">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-2 tracking-tight">
              Watch the algorithm<span className="text-[#bea9e9]">.</span>
            </h2>
            <p className="text-gray-600 max-w-2xl">
              Step through a canonical optimal solution. The pseudocode panel lights up the lines
              of <em>Bidirectional BFIDA*</em> that drive each decision.
            </p>
          </div>
          <BoardToggle value={kind} onChange={handleSwitch} />
        </div>

        <p className="text-xs text-gray-500 mb-8 max-w-2xl italic">
          Visualization driven by a published optimal solution
          {kind === "english"
            ? " (Bergholt 1912, 31 jumps)."
            : " (35 jumps; the 37-hole European board has no center-to-center single-peg solution, so we demo a solvable variant)."}{" "}
          Full BFIDA* on these boards won't run in a browser - this is the algorithm's shape, not
          its literal compute.
        </p>

        <div className="grid md:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="md:col-span-7 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handlePlayPause}
                className="bg-black hover:bg-gray-800 text-white rounded-xl px-4 py-2 text-sm font-medium h-auto"
              >
                {playing ? "Pause" : isFinalStep ? "Replay" : "Play"}
              </Button>
              <Button
                onClick={() => handleStep(-1)}
                variant="outline"
                className="border-black text-black hover:bg-gray-100 rounded-xl px-3 py-2 text-sm font-medium h-auto"
              >
                ‹ Step
              </Button>
              <Button
                onClick={() => handleStep(1)}
                variant="outline"
                className="border-black text-black hover:bg-gray-100 rounded-xl px-3 py-2 text-sm font-medium h-auto"
              >
                Step ›
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-black text-black hover:bg-gray-100 rounded-xl px-3 py-2 text-sm font-medium h-auto"
              >
                Reset
              </Button>
              <div className="flex items-center gap-2 text-xs text-gray-600 ml-auto">
                <span>Speed</span>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.25}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="accent-black"
                  aria-label="Playback speed"
                />
                <span className="font-mono w-8 text-right">{speed.toFixed(2)}x</span>
              </div>
            </div>

            <div className="rounded-2xl border border-black bg-white p-4 sm:p-6 md:p-8">
              <PegBoard
                board={board}
                mode="replay"
                emphasizeFrom={upcomingJump?.from ?? null}
                emphasizeTo={upcomingJump?.to ?? null}
                className="max-w-md mx-auto"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                Step {stepIdx + 1} / {totalSteps}
              </span>
              <span>
                Jump {jumpDisplay} / {solution.jumps.length}
              </span>
            </div>

            <div className="border border-black bg-white rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                Considered jumps
              </p>
              <div className="flex flex-wrap gap-2">
                {(currentStep.alternatives ?? []).map((alt, i) => {
                  const label = `(${alt.from[0]},${alt.from[1]}) → (${alt.to[0]},${alt.to[1]})`
                  return (
                    <span
                      key={`${alt.from[0]}-${alt.from[1]}-${alt.to[0]}-${alt.to[1]}-${i}`}
                      className={`font-mono text-xs px-2 py-1 rounded border ${
                        alt.pruned
                          ? "border-gray-300 text-gray-400 line-through bg-gray-50"
                          : "border-[#bea9e9] text-[#3f2380] bg-[#bea9e9]/20 font-medium"
                      }`}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col gap-4">
            <PseudocodePanel highlight={currentStep.highlight} />
            <AlgorithmStats stats={currentStep.stats} />
          </div>
        </div>
      </div>
    </section>
  )
}
