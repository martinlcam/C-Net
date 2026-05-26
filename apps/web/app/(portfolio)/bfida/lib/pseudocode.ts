export type PseudocodeLine = {
  id: string
  text: string
  indent: number
}

/**
 * Bidirectional BFIDA* in research-paper form: explicit upper bound UB, true
 * IDA*-style contour expansion via nextBound, and the inner loop factored into
 * its own procedure. Structurally mirrors Barker and Korf (2012) but written
 * for readability over byte-for-byte fidelity.
 */
export const PSEUDOCODE: PseudocodeLine[] = [
  { id: "L1", indent: 0, text: "procedure Bidirectional_BFIDA*(start, goal):" },
  { id: "L2", indent: 1, text: "OPEN_F  ← { start }   ; g_F(start) ← 0" },
  { id: "L3", indent: 1, text: "OPEN_B  ← { goal }    ; g_B(goal)  ← 0" },
  { id: "L4", indent: 1, text: "bound_F ← h_F(start)  ; bound_B ← h_B(goal)" },
  { id: "L5", indent: 1, text: "UB      ← ∞          ; bestPath ← null" },
  { id: "L6", indent: 1, text: "repeat" },
  { id: "L7", indent: 2, text: "dir ← SelectDirection(OPEN_F, OPEN_B)" },
  { id: "L8", indent: 2, text: "if dir = FORWARD then" },
  { id: "L9", indent: 3, text: "bound_F ← ExpandContour(F, B)" },
  { id: "L10", indent: 2, text: "else" },
  { id: "L11", indent: 3, text: "bound_B ← ExpandContour(B, F)" },
  { id: "L12", indent: 1, text: "until UB ≤ max(bound_F, bound_B)" },
  { id: "L13", indent: 1, text: "return bestPath" },
  { id: "L14", indent: 0, text: "" },
  { id: "L15", indent: 0, text: "procedure ExpandContour(OPEN, OPPOSITE):" },
  { id: "L16", indent: 1, text: "nextBound ← ∞ ;  NEW_OPEN ← ∅" },
  { id: "L17", indent: 1, text: "for each node in OPEN do" },
  { id: "L18", indent: 2, text: "f ← g(node) + h(node)" },
  { id: "L19", indent: 2, text: "if f > bound then" },
  { id: "L20", indent: 3, text: "nextBound ← min(nextBound, f) ;  continue" },
  { id: "L21", indent: 2, text: "if PagodaFail(node) or PegTypeFail(node) then" },
  { id: "L22", indent: 3, text: "continue" },
  { id: "L23", indent: 2, text: "if node ∈ OPPOSITE then" },
  { id: "L24", indent: 3, text: "pathCost ← g(node) + g_opp(node)" },
  { id: "L25", indent: 3, text: "if pathCost < UB then" },
  { id: "L26", indent: 4, text: "UB ← pathCost ; bestPath ← Reconstruct(node)" },
  { id: "L27", indent: 3, text: "continue" },
  { id: "L28", indent: 2, text: "for each child in Successors(node) do" },
  { id: "L29", indent: 3, text: "g(child) ← g(node) + cost(node, child)" },
  { id: "L30", indent: 3, text: "NEW_OPEN.add(child)" },
  { id: "L31", indent: 1, text: "OPEN ← NEW_OPEN" },
  { id: "L32", indent: 1, text: "return nextBound" },
]
