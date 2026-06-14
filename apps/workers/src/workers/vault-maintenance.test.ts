import { describe, expect, it } from "bun:test"
import { cutoffDate } from "./vault-maintenance"

describe("cutoffDate", () => {
  it("subtracts the interval from now", () => {
    const now = 1_000_000_000
    expect(cutoffDate(now, 1000).getTime()).toBe(now - 1000)
  })
})
