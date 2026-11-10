import { describe, expect, it } from "bun:test"
import { resolveCollision, uniqueZipNames } from "./naming"

describe("resolveCollision", () => {
  const taken = new Set(["file.txt", "file (1).txt", "report.pdf"])
  it("returns the name unchanged when free", () => {
    expect(resolveCollision("fresh.txt", taken)).toBe("fresh.txt")
  })
  it("appends an incrementing counter, skipping taken names", () => {
    expect(resolveCollision("file.txt", taken)).toBe("file (2).txt")
  })
  it("handles names without an extension", () => {
    expect(resolveCollision("report.pdf", taken)).toBe("report (1).pdf")
    expect(resolveCollision("README", new Set(["README"]))).toBe("README (1)")
  })
  it("uses a custom suffix for restores", () => {
    const t = new Set(["a.txt"])
    expect(resolveCollision("a.txt", t, "restored")).toBe("a (restored).txt")
    t.add("a (restored).txt")
    expect(resolveCollision("a.txt", t, "restored")).toBe("a (restored 2).txt")
  })
})

describe("uniqueZipNames", () => {
  it("numbers repeats before the extension and leaves the first alone", () => {
    expect(uniqueZipNames(["a.jpg", "b.jpg", "a.jpg", "a.jpg", "README"])).toEqual([
      "a.jpg",
      "b.jpg",
      "a (2).jpg",
      "a (3).jpg",
      "README",
    ])
  })

  it("treats names that differ only by case as the same file", () => {
    expect(uniqueZipNames(["Photo.JPG", "photo.jpg"])).toEqual(["Photo.JPG", "photo (2).jpg"])
  })
})
