// Pure helpers behind multi-select in the file grid: toggling, shift ranges in display order,
// and the rubber-band rectangle that selects whatever it crosses.

export type Rect = { left: number; top: number; right: number; bottom: number }

export function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  return {
    left: Math.min(ax, bx),
    top: Math.min(ay, by),
    right: Math.max(ax, bx),
    bottom: Math.max(ay, by),
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/** Ids between (and including) two ids in display order; just the target if the anchor is gone. */
export function rangeBetween(order: string[], anchor: string | null, target: string): string[] {
  const t = order.indexOf(target)
  if (t < 0) return []
  const a = anchor ? order.indexOf(anchor) : -1
  if (a < 0) return [target]
  const [from, to] = a < t ? [a, t] : [t, a]
  return order.slice(from, to + 1)
}

export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * The selection after a drag: everything the band crosses, plus what was selected before
 * the drag when the modifier key asks to add to it.
 */
export function marqueeSelection(
  band: Rect,
  items: Array<{ id: string; rect: Rect }>,
  before: ReadonlySet<string>,
  additive: boolean
): Set<string> {
  const next = new Set(additive ? before : [])
  for (const item of items) if (rectsIntersect(band, item.rect)) next.add(item.id)
  return next
}

/** A press that moved less than this is a click, not the start of a band. */
export const DRAG_THRESHOLD_PX = 6
