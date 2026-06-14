import { describe, expect, it } from "bun:test"
import { getAllowlistEntry, isEmailAuthorized, parseAllowlist, parseSize } from "./allowlist"

const RAW = JSON.stringify([
  { email: "super@x.com", role: "super" },
  { email: "alice@x.com", role: "storage", quota: "1T" },
  { email: "bob@x.com", role: "storage", quota: "500G" },
])

describe("parseSize", () => {
  it("parses binary units", () => {
    expect(parseSize("1T")).toBe(1024 ** 4)
    expect(parseSize("500G")).toBe(500 * 1024 ** 3)
    expect(parseSize("250M")).toBe(250 * 1024 ** 2)
    expect(parseSize("1024")).toBe(1024)
  })
  it("throws on garbage", () => {
    expect(() => parseSize("banana")).toThrow()
  })
})

describe("parseAllowlist", () => {
  it("parses entries and quota to bytes", () => {
    const list = parseAllowlist(RAW)
    expect(list).toHaveLength(3)
    expect(list[0]).toEqual({ email: "super@x.com", role: "super", quotaBytes: null })
    expect(list[1].quotaBytes).toBe(1024 ** 4)
  })
  it("is case-insensitive on email and falls back to a super default when unset", () => {
    const list = parseAllowlist(undefined)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].role).toBe("super")
  })
})

describe("getAllowlistEntry / isEmailAuthorized", () => {
  const list = parseAllowlist(RAW)
  it("matches case-insensitively", () => {
    expect(getAllowlistEntry("ALICE@x.com", list)?.role).toBe("storage")
    expect(isEmailAuthorized("bob@x.com", list)).toBe(true)
  })
  it("rejects unlisted emails", () => {
    expect(getAllowlistEntry("eve@x.com", list)).toBeNull()
    expect(isEmailAuthorized("eve@x.com", list)).toBe(false)
  })
})
