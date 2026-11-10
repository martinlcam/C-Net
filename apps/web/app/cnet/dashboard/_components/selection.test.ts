import { describe, expect, it } from "bun:test"
import {
  marqueeSelection,
  rangeBetween,
  rectFromPoints,
  rectsIntersect,
  toggleId,
} from "./selection"

describe("rectFromPoints / rectsIntersect", () => {
  it("normalises a band dragged in any direction", () => {
    expect(rectFromPoints(50, 60, 10, 20)).toEqual({ left: 10, top: 20, right: 50, bottom: 60 })
  })

  it("treats touching edges as not overlapping", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(rectsIntersect(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false)
    expect(rectsIntersect(a, { left: 9, top: 9, right: 20, bottom: 20 })).toBe(true)
  })
})

describe("rangeBetween", () => {
  const order = ["a", "b", "c", "d", "e"]
  it("selects the inclusive run in either direction", () => {
    expect(rangeBetween(order, "b", "d")).toEqual(["b", "c", "d"])
    expect(rangeBetween(order, "d", "b")).toEqual(["b", "c", "d"])
  })
  it("falls back to the target alone without an anchor or when the anchor left the list", () => {
    expect(rangeBetween(order, null, "c")).toEqual(["c"])
    expect(rangeBetween(order, "zzz", "c")).toEqual(["c"])
    expect(rangeBetween(order, "a", "zzz")).toEqual([])
  })
})

describe("toggleId", () => {
  it("adds and removes without mutating the input", () => {
    const s = new Set(["a"])
    const added = toggleId(s, "b")
    expect([...added]).toEqual(["a", "b"])
    expect([...toggleId(added, "a")]).toEqual(["b"])
    expect([...s]).toEqual(["a"])
  })
})

describe("marqueeSelection", () => {
  const items = [
    { id: "a", rect: { left: 0, top: 0, right: 100, bottom: 100 } },
    { id: "b", rect: { left: 120, top: 0, right: 220, bottom: 100 } },
    { id: "c", rect: { left: 0, top: 120, right: 100, bottom: 220 } },
  ]
  it("takes what the band crosses and drops the old selection by default", () => {
    const band = { left: 90, top: 10, right: 130, bottom: 20 }
    expect([...marqueeSelection(band, items, new Set(["c"]), false)]).toEqual(["a", "b"])
  })
  it("keeps the old selection when adding", () => {
    const band = { left: 90, top: 10, right: 130, bottom: 20 }
    expect([...marqueeSelection(band, items, new Set(["c"]), true)].sort()).toEqual(["a", "b", "c"])
  })
})
