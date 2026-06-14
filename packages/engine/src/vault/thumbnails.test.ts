import { describe, expect, it } from "bun:test"
import { pickGenerator } from "./thumbnails"

describe("pickGenerator", () => {
  it("maps image content types", () => {
    expect(pickGenerator("image/png")).toBe("image")
    expect(pickGenerator("IMAGE/JPEG")).toBe("image")
  })
  it("maps pdf", () => {
    expect(pickGenerator("application/pdf")).toBe("pdf")
  })
  it("maps video", () => {
    expect(pickGenerator("video/mp4")).toBe("video")
  })
  it("returns null for unsupported types", () => {
    expect(pickGenerator("text/plain")).toBeNull()
    expect(pickGenerator("application/zip")).toBeNull()
  })
})
