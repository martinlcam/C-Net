import { describe, expect, it } from "bun:test"
import { codeLanguage, isHeicFile, isPptxFile, previewKind } from "./file-preview"

describe("file preview detection", () => {
  it("detects HEIC by mime and extension", () => {
    expect(isHeicFile("image/heic", "photo.jpg")).toBe(true)
    expect(isHeicFile("image/heif", "photo.jpg")).toBe(true)
    expect(isHeicFile(null, "IMG_0001.HEIC")).toBe(true)
    expect(isHeicFile("image/jpeg", "photo.jpg")).toBe(false)
  })

  it("detects PPTX by mime and extension", () => {
    expect(
      isPptxFile(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "deck.bin"
      )
    ).toBe(true)
    expect(isPptxFile(null, "slides.pptx")).toBe(true)
    expect(isPptxFile("application/pdf", "slides.pdf")).toBe(false)
  })

  it("maps python to code preview", () => {
    expect(codeLanguage("script.py")).toBe("python")
    expect(previewKind("text/plain", "script.py")).toBe("code")
  })

  it("routes HEIC before generic image", () => {
    expect(previewKind("image/heic", "photo.heic")).toBe("heic")
    expect(previewKind("image/png", "photo.png")).toBe("image")
  })

  it("routes PPTX to pptx preview", () => {
    expect(previewKind(null, "talk.pptx")).toBe("pptx")
  })
})
