/**
 * Validates that both canned solutions in lib/solutions.ts are legal
 * sequences ending with a single peg in the documented position.
 *
 * Run: bun run apps/web/scripts/verify-bfida-solutions.ts
 */

import { type Board, type Cell, type Jump, makeBoard } from "../app/(portfolio)/bfida/lib/boards"
import { SOLUTIONS } from "../app/(portfolio)/bfida/lib/solutions"

function applyJump(board: Board, j: Jump): Board {
  const next: Cell[][] = board.cells.map((r) => r.slice())
  const [fr, fc] = j.from
  const [or, oc] = j.over
  const [tr, tc] = j.to
  if (next[fr]) next[fr][fc] = "hole"
  if (next[or]) next[or][oc] = "hole"
  if (next[tr]) next[tr][tc] = "peg"
  return { kind: board.kind, cells: next, holes: board.holes }
}

function pegCount(b: Board): number {
  let n = 0
  for (const row of b.cells) for (const c of row) if (c === "peg") n++
  return n
}

let allOk = true
for (const sol of Object.values(SOLUTIONS)) {
  let board = makeBoard(sol.kind)
  const [er, ec] = sol.emptyAt
  if (sol.emptyAt[0] !== 3 || sol.emptyAt[1] !== 3) {
    if (board.cells[er]?.[ec] !== "peg" || board.cells[3]?.[3] !== "hole") {
      console.error(`${sol.id}: emptyAt setup is wrong`)
      allOk = false
      continue
    }
    if (board.cells[er]) (board.cells[er] as Cell[])[ec] = "hole"
    if (board.cells[3]) (board.cells[3] as Cell[])[3] = "peg"
  }

  console.log(`\nVerifying ${sol.id}: ${sol.label}`)
  console.log(`  Start pegs: ${pegCount(board)}, expected ${sol.kind === "english" ? 32 : 36}`)

  for (let i = 0; i < sol.jumps.length; i++) {
    const j = sol.jumps[i]
    if (!j) continue
    const [fr, fc] = j.from
    const [or, oc] = j.over
    const [tr, tc] = j.to
    const from = board.cells[fr]?.[fc]
    const over = board.cells[or]?.[oc]
    const to = board.cells[tr]?.[tc]
    if (from !== "peg" || over !== "peg" || to !== "hole") {
      console.error(
        `  Move ${i + 1} (${j.from}->${j.to}) ILLEGAL: from=${from}, over=${over}, to=${to}`
      )
      allOk = false
      break
    }
    board = applyJump(board, j)
  }

  const finalPegs = pegCount(board)
  const [ger, gec] = sol.endPeg
  const finalCell = board.cells[ger]?.[gec]
  const ok = finalPegs === 1 && finalCell === "peg"
  if (ok) {
    console.log(`  OK - 1 peg at (${ger},${gec}) after ${sol.jumps.length} jumps`)
  } else {
    console.error(`  FAIL - ${finalPegs} pegs remain, target cell = ${finalCell}`)
    allOk = false
  }
}

if (!allOk) process.exit(1)
console.log("\nAll solutions valid.")
