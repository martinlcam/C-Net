import { describe, expect, it } from "bun:test"
import { cutoffDate, uploadTtlHours } from "./vault-maintenance"

describe("cutoffDate", () => {
  it("subtracts the interval from now", () => {
    const now = 1_000_000_000
    expect(cutoffDate(now, 1000).getTime()).toBe(now - 1000)
  })
})

describe("uploadTtlHours", () => {
  it("defaults to 48 hours so a laptop closed overnight can still resume", () => {
    expect(uploadTtlHours({})).toBe(48)
  })
  it("honours VAULT_UPLOAD_TTL_HOURS", () => {
    expect(uploadTtlHours({ VAULT_UPLOAD_TTL_HOURS: "6" })).toBe(6)
  })
})
