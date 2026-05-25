import { type Board, type BoardKind, type Cell, type Jump, type Position, makeBoard } from "./boards"

const DIRS: Array<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const

/** All legal jumps from a position on the given board state. */
export function jumpsFrom(board: Board, from: Position): Jump[] {
  const [r, c] = from
  if (board.cells[r]?.[c] !== "peg") return []
  const out: Jump[] = []
  for (const [dr, dc] of DIRS) {
    const overR = r + dr
    const overC = c + dc
    const toR = r + 2 * dr
    const toC = c + 2 * dc
    if (board.cells[overR]?.[overC] === "peg" && board.cells[toR]?.[toC] === "hole") {
      out.push({
        from: [r, c],
        over: [overR, overC],
        to: [toR, toC],
      })
    }
  }
  return out
}

/** All legal jumps available on the board. */
export function allJumps(board: Board): Jump[] {
  const out: Jump[] = []
  for (const [r, c] of board.holes) {
    if (board.cells[r]?.[c] === "peg") out.push(...jumpsFrom(board, [r, c]))
  }
  return out
}

/** Returns a new board with the jump applied. Does not mutate the input. */
export function applyJump(board: Board, jump: Jump): Board {
  const next: Cell[][] = board.cells.map((row) => row.slice())
  const [fr, fc] = jump.from
  const [or, oc] = jump.over
  const [tr, tc] = jump.to
  if (next[fr]) next[fr][fc] = "hole"
  if (next[or]) next[or][oc] = "hole"
  if (next[tr]) next[tr][tc] = "peg"
  return { kind: board.kind, cells: next, holes: board.holes }
}

export function pegsRemaining(board: Board): number {
  let n = 0
  for (const [r, c] of board.holes) {
    if (board.cells[r]?.[c] === "peg") n++
  }
  return n
}

/** True if no legal jumps remain. */
export function isStuck(board: Board): boolean {
  return allJumps(board).length === 0
}

/** Returns the "click" outcome: the unique legal jump from `from` to `to`, or null. */
export function findJump(board: Board, from: Position, to: Position): Jump | null {
  const candidates = jumpsFrom(board, from)
  return (
    candidates.find(
      (j) => j.to[0] === to[0] && j.to[1] === to[1] && j.from[0] === from[0] && j.from[1] === from[1]
    ) ?? null
  )
}

/** Build a fresh board in its standard starting position (center empty). */
export function startingBoard(kind: BoardKind): Board {
  return makeBoard(kind)
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}
