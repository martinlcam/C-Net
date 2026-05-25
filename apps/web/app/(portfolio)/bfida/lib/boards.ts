export type BoardKind = "english" | "european"

export type Cell = "peg" | "hole" | "off"

export type Position = readonly [number, number]

export type Jump = {
  from: Position
  over: Position
  to: Position
}

export type Board = {
  kind: BoardKind
  /** 7x7 grid of cells. "off" cells are outside the playable area. */
  cells: Cell[][]
  /** Convenience list of every playable (row, col). */
  holes: Position[]
}

const O = "off" as Cell
const H = "hole" as Cell
const P = "peg" as Cell

/** English board: 7x7 with 3x3 corners cut off. 33 holes, center (3,3) empty. */
const ENGLISH_LAYOUT: Cell[][] = [
  [O, O, P, P, P, O, O],
  [O, O, P, P, P, O, O],
  [P, P, P, P, P, P, P],
  [P, P, P, H, P, P, P],
  [P, P, P, P, P, P, P],
  [O, O, P, P, P, O, O],
  [O, O, P, P, P, O, O],
]

/**
 * European/French board: 7x7 with stair-step corners (corners cut as 2x2,
 * yielding extra holes at (1,1), (1,5), (5,1), (5,5) vs English). 37 holes,
 * center (3,3) empty.
 */
const EUROPEAN_LAYOUT: Cell[][] = [
  [O, O, P, P, P, O, O],
  [O, P, P, P, P, P, O],
  [P, P, P, P, P, P, P],
  [P, P, P, H, P, P, P],
  [P, P, P, P, P, P, P],
  [O, P, P, P, P, P, O],
  [O, O, P, P, P, O, O],
]

function holesOf(layout: Cell[][]): Position[] {
  const out: Position[] = []
  for (let r = 0; r < layout.length; r++) {
    for (let c = 0; c < (layout[r]?.length ?? 0); c++) {
      if (layout[r]?.[c] !== O) out.push([r, c] as const)
    }
  }
  return out
}

export function makeBoard(kind: BoardKind): Board {
  const layout = kind === "english" ? ENGLISH_LAYOUT : EUROPEAN_LAYOUT
  return {
    kind,
    cells: layout.map((row) => row.slice()),
    holes: holesOf(layout),
  }
}

export const BOARD_SIZE = 7

/** Returns true if the position is inside the playable region of this board kind. */
export function isPlayable(kind: BoardKind, r: number, c: number): boolean {
  const layout = kind === "english" ? ENGLISH_LAYOUT : EUROPEAN_LAYOUT
  return layout[r]?.[c] !== undefined && layout[r]?.[c] !== O
}

/** Center hole position - same for both boards. */
export const CENTER: Position = [3, 3]
