import { describe, expect, it } from "bun:test"
import { safeCallbackUrl, signInErrorMessage } from "./auth-messages"

describe("signInErrorMessage", () => {
  it("explains the allowlist rejection in the user's terms", () => {
    expect(signInErrorMessage("AccessDenied")).toContain("isn't on the list")
  })

  it("tells a bounced visitor to sign in", () => {
    expect(signInErrorMessage("Unauthorized")).toBe("Sign in to open that page.")
  })

  it("has a fallback for codes it does not know and nothing for no code", () => {
    expect(signInErrorMessage("SomethingNew")).toContain("Try again")
    expect(signInErrorMessage(null)).toBeNull()
    expect(signInErrorMessage("")).toBeNull()
  })
})

describe("safeCallbackUrl", () => {
  it("keeps same-site paths and drops anything else", () => {
    expect(safeCallbackUrl("/cnet/dashboard/files")).toBe("/cnet/dashboard/files")
    expect(safeCallbackUrl("https://evil.example/")).toBe("/cnet/dashboard")
    expect(safeCallbackUrl("//evil.example")).toBe("/cnet/dashboard")
    expect(safeCallbackUrl(null)).toBe("/cnet/dashboard")
  })
})
