/**
 * Canonical optimal solutions for both boards, transcribed from documented sources:
 *
 * - English 33-hole, center -> center: 31 jumps composing Bergholt's 18-move solution
 *   (1912, proven optimal by Beasley 1964). Hole indices follow Durango Bill's
 *   numbering at https://www.durangobill.com/Peg33.html .
 *
 * - European 37-hole: the center-empty -> center-peg game is provably unsolvable
 *   under orthogonal jumps (parity / A-B-C colouring argument; see Wikipedia and
 *   Beasley). We use European solvable starting position 1 from
 *   https://en.wikipedia.org/wiki/Peg_solitaire :
 *     empty at (0,2), 35 jumps, finishes with a single peg at (0,4).
 */

import type { BoardKind, Jump, Position } from "./boards"

export type Solution = {
  id: string
  label: string
  kind: BoardKind
  /** The single empty hole at the start. */
  emptyAt: Position
  /** Where the single remaining peg ends up. */
  endPeg: Position
  /** Side note shown beneath the board in the solver section. */
  note: string
  /** Ordered list of jumps. */
  jumps: Jump[]
}

// ---------- English: Bergholt 1912, center -> center ----------
// Source list (Durango Bill, hole indices 0..32):
//   4->16, 7->9, 0->8, 2->0, 9->7, 6->8, 10->2, 12->10, 15->3, 0->8, 13->15,
//   15->3, 17->5, 2->10, 19->17, 17->5, 27->15, 20->22, 22->8, 3->15, 15->17,
//   24->10, 5->17, 26->24, 23->25, 32->24, 17->29, 30->32, 32->24, 25->23, 28->16
const ENGLISH_HOLE_INDEX_TO_POSITION: Position[] = [
  [0, 2], [0, 3], [0, 4],
  [1, 2], [1, 3], [1, 4],
  [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6],
  [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6],
  [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6],
  [5, 2], [5, 3], [5, 4],
  [6, 2], [6, 3], [6, 4],
]

const ENGLISH_PAIRS: Array<[number, number]> = [
  [4, 16], [7, 9], [0, 8], [2, 0], [9, 7], [6, 8], [10, 2], [12, 10],
  [15, 3], [0, 8], [13, 15], [15, 3], [17, 5], [2, 10], [19, 17], [17, 5],
  [27, 15], [20, 22], [22, 8], [3, 15], [15, 17], [24, 10], [5, 17],
  [26, 24], [23, 25], [32, 24], [17, 29], [30, 32], [32, 24], [25, 23],
  [28, 16],
]

function pairToJump(from: number, to: number): Jump {
  const f = ENGLISH_HOLE_INDEX_TO_POSITION[from] as Position
  const t = ENGLISH_HOLE_INDEX_TO_POSITION[to] as Position
  const over: Position = [(f[0] + t[0]) / 2, (f[1] + t[1]) / 2]
  return { from: f, over, to: t }
}

const ENGLISH_JUMPS: Jump[] = ENGLISH_PAIRS.map(([a, b]) => pairToJump(a, b))

// ---------- European: solvable starting position 1, (0,2) empty -> (0,4) ----------
// Source: Wikipedia "Peg solitaire" > Solutions to the European game > position 1.
// Each entry is "fromR:fromC -> toR:toC"; the jumped peg sits between them.
const EUROPEAN_RAW: Array<[Position, Position]> = [
  [[2, 2], [0, 2]],
  [[2, 0], [2, 2]],
  [[1, 4], [1, 2]],
  [[3, 4], [1, 4]],
  [[3, 2], [3, 4]],
  [[2, 3], [2, 1]],
  [[5, 3], [3, 3]],
  [[3, 0], [3, 2]],
  [[5, 1], [3, 1]],
  [[4, 5], [4, 3]],
  [[5, 5], [5, 3]],
  [[0, 4], [2, 4]],
  [[2, 1], [4, 1]],
  [[2, 4], [4, 4]],
  [[5, 2], [5, 4]],
  [[3, 6], [3, 4]],
  [[1, 1], [1, 3]],
  [[2, 6], [2, 4]],
  [[0, 3], [2, 3]],
  [[3, 2], [5, 2]],
  [[3, 4], [3, 2]],
  [[6, 2], [4, 2]],
  [[3, 2], [5, 2]],
  [[4, 0], [4, 2]],
  [[4, 3], [4, 1]],
  [[6, 4], [6, 2]],
  [[6, 2], [4, 2]],
  [[4, 1], [4, 3]],
  [[4, 3], [4, 5]],
  [[4, 6], [4, 4]],
  [[5, 4], [3, 4]],
  [[3, 4], [1, 4]],
  [[1, 5], [1, 3]],
  [[2, 3], [0, 3]],
  [[0, 2], [0, 4]],
]

function ftJump(from: Position, to: Position): Jump {
  const over: Position = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  return { from, over, to }
}

const EUROPEAN_JUMPS: Jump[] = EUROPEAN_RAW.map(([f, t]) => ftJump(f, t))

export const SOLUTIONS: Record<BoardKind, Solution> = {
  english: {
    id: "english-center",
    label: "English board, center -> center",
    kind: "english",
    emptyAt: [3, 3],
    endPeg: [3, 3],
    note: "Bergholt 1912, 18 moves (31 jumps). Proven optimal by Beasley, 1964.",
    jumps: ENGLISH_JUMPS,
  },
  european: {
    id: "european-1",
    label: "European board, (0,2) -> (0,4)",
    kind: "european",
    emptyAt: [0, 2],
    endPeg: [0, 4],
    note:
      "The 37-hole board has no single-peg solution from a center-empty start (proven via 3-colour parity), so the solver demos a canonical solvable variant: empty at (0,2), final peg at (0,4).",
    jumps: EUROPEAN_JUMPS,
  },
}
