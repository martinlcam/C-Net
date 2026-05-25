/**
 * Builds a step-by-step trace for the algorithm visualizer.
 *
 * Each TraceStep represents one "tick" of the visualizer. A tick either
 * (a) highlights an algorithm phase without changing the board, or
 * (b) applies a single jump from the canned solution and highlights the
 *     "expand successors / add child" pseudocode lines.
 *
 * Stats values (cutoff, f/g/h, frontier sizes, nodesExpanded) are synthesized
 * to be plausible: they grow monotonically along the search depth and reflect
 * the qualitative shape of BFIDA*'s behaviour (forward/backward alternation,
 * eventual frontier intersection). They are not literal outputs of running
 * the algorithm in the browser.
 */

import type { BoardKind, Jump, Position } from "./boards"
import type { Solution } from "./solutions"
import { SOLUTIONS } from "./solutions"

export type TraceStats = {
  direction: "forward" | "backward"
  cutoff: number
  g: number
  h: number
  f: number
  nodesExpanded: number
  frontierForward: number
  frontierBackward: number
  intersection?: boolean
}

export type TraceAlternative = {
  from: Position
  to: Position
  pruned: boolean
}

export type TraceStep = {
  /**
   * Index into `solution.jumps`. If null the step is a non-board "algorithm phase"
   * tick (e.g. choosing direction at the top of a new iteration).
   */
  jumpIndex: number | null
  /** Pseudocode line ids to highlight. */
  highlight: string[]
  /** Short phase label for the stats badge. */
  phase: string
  stats: TraceStats
  alternatives?: TraceAlternative[]
}

/** Deterministic faux-random in [0,1) given an integer seed. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/**
 * Build a few plausible-looking "considered alternatives" for a given jump.
 * One of them is the chosen jump (not pruned); the others are nearby
 * synthetic jumps that get marked pruned.
 */
function alternatives(jump: Jump, seed: number): TraceAlternative[] {
  const out: TraceAlternative[] = [{ from: jump.from, to: jump.to, pruned: false }]
  const dirs: Array<[number, number]> = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ]
  const start = Math.floor(rand(seed) * 4)
  for (let i = 0; i < 3; i++) {
    const d = dirs[(start + i) % 4]
    if (!d) continue
    const [dr, dc] = d
    out.push({
      from: jump.from,
      to: [jump.from[0] + dr, jump.from[1] + dc],
      pruned: true,
    })
  }
  return out
}

const DEFAULT_BACKGROUND_HIGHLIGHT = ["L4", "L5", "L6", "L11"]

export function buildTrace(kind: BoardKind): TraceStep[] {
  const solution: Solution = SOLUTIONS[kind]
  const totalJumps = solution.jumps.length
  const steps: TraceStep[] = []

  // Pre-jump setup tick: highlight algorithm initialization.
  steps.push({
    jumpIndex: null,
    highlight: ["L1", "L2", "L3"],
    phase: "init",
    stats: {
      direction: "forward",
      cutoff: 18,
      g: 0,
      h: 18,
      f: 18,
      nodesExpanded: 0,
      frontierForward: 1,
      frontierBackward: 1,
    },
  })

  for (let i = 0; i < totalJumps; i++) {
    const jump = solution.jumps[i]
    if (!jump) continue

    const progress = i / Math.max(1, totalJumps - 1)
    const direction: "forward" | "backward" = i % 5 === 4 ? "backward" : "forward"
    const g = i + 1
    const h = Math.max(1, Math.round((1 - progress) * 14 + 4))
    const cutoff = Math.max(g + h, Math.round(18 + progress * 6))
    const baseNodes = Math.round(2_000 * (1 + i) ** 1.7 + rand(i) * 1500)
    const frontierForward = Math.round(80 + i * 24 + rand(i + 101) * 60)
    const frontierBackward = Math.round(40 + i * 18 + rand(i + 202) * 40)
    const isIntersection = i === totalJumps - 1

    // (a) "examine node" tick: highlight the inner BFHS lines.
    steps.push({
      jumpIndex: null,
      highlight:
        i === 0
          ? ["L4", "L5", "L6", "L7", "L10", "L11"]
          : ["L11", "L12", "L13", ...(isIntersection ? ["L14", "L15"] : [])],
      phase: isIntersection ? "frontier intersection" : "expand node",
      stats: {
        direction,
        cutoff,
        g,
        h,
        f: g + h,
        nodesExpanded: baseNodes,
        frontierForward,
        frontierBackward,
        intersection: isIntersection,
      },
      alternatives: alternatives(jump, i),
    })

    // (b) "apply child" tick: animate the jump on the board.
    steps.push({
      jumpIndex: i,
      highlight: isIntersection ? ["L14", "L15", "L16"] : ["L17", "L18"],
      phase: isIntersection ? "solution proven" : "apply successor",
      stats: {
        direction,
        cutoff,
        g,
        h: Math.max(0, h - 1),
        f: g + Math.max(0, h - 1),
        nodesExpanded: baseNodes + Math.round(rand(i + 333) * 800),
        frontierForward,
        frontierBackward,
        intersection: isIntersection,
      },
      alternatives: alternatives(jump, i),
    })
  }

  return steps
}

export { DEFAULT_BACKGROUND_HIGHLIGHT }
