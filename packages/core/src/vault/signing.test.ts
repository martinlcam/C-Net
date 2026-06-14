import { describe, expect, it } from "bun:test"
import { signDownload, verifyDownload } from "./signing"

const SECRET = "test-secret"

describe("signDownload / verifyDownload", () => {
  it("round-trips a valid token", () => {
    const exp = 10_000
    const sig = signDownload({ userId: "u1", fileId: "f1", exp, disposition: "inline" }, SECRET)
    const res = verifyDownload(
      { userId: "u1", fileId: "f1", exp, disposition: "inline", sig },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(true)
  })
  it("rejects an expired token", () => {
    const sig = signDownload(
      { userId: "u1", fileId: "f1", exp: 1_000, disposition: "inline" },
      SECRET
    )
    const res = verifyDownload(
      { userId: "u1", fileId: "f1", exp: 1_000, disposition: "inline", sig },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(false)
  })
  it("rejects a forged signature", () => {
    const res = verifyDownload(
      { userId: "u1", fileId: "f1", exp: 10_000, disposition: "inline", sig: "deadbeef" },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(false)
  })
  it("rejects a tampered field", () => {
    const sig = signDownload(
      { userId: "u1", fileId: "f1", exp: 10_000, disposition: "inline" },
      SECRET
    )
    const res = verifyDownload(
      { userId: "u1", fileId: "OTHER", exp: 10_000, disposition: "inline", sig },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(false)
  })
})
