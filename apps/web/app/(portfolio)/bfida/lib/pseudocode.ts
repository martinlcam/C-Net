export type PseudocodeLine = {
  id: string
  text: string
  indent: number
}

/**
 * Stylized Bidirectional BFIDA* pseudocode, structurally mirroring
 * Barker and Korf (2012), "Solving Peg Solitaire with Bidirectional BFIDA*".
 */
export const PSEUDOCODE: PseudocodeLine[] = [
  { id: "L1", indent: 0, text: "function bidirectionalBFIDA*(start, goal):" },
  { id: "L2", indent: 1, text: "forward  = frontier(start)" },
  { id: "L3", indent: 1, text: "backward = frontier(goal)" },
  { id: "L4", indent: 1, text: "while not solutionProven:" },
  { id: "L5", indent: 2, text: "dir    = chooseDirection(forward, backward)   # Pohl cardinality" },
  { id: "L6", indent: 2, text: "cutoff = currentCutoff(dir)" },
  { id: "L7", indent: 2, text: "bfhsIteration(dir, cutoff)" },
  { id: "L8", indent: 2, text: "if cutoff(dir) == bestSolutionCost: return best" },
  { id: "L9", indent: 0, text: "" },
  { id: "L10", indent: 0, text: "function bfhsIteration(dir, cutoff):" },
  { id: "L11", indent: 1, text: "for node in frontier(dir):" },
  { id: "L12", indent: 2, text: "if g(node) + h(node) > cutoff: prune" },
  { id: "L13", indent: 2, text: "if pagoda(node) or pegTypeFail(node): prune" },
  { id: "L14", indent: 2, text: "if intersects(opposing.frontier, node):" },
  { id: "L15", indent: 3, text: "best = min(best, g(node) + g_opposing(node))" },
  { id: "L16", indent: 3, text: "continue" },
  { id: "L17", indent: 2, text: "for child in successors(node):" },
  { id: "L18", indent: 3, text: "frontier(dir).add(child)" },
]
