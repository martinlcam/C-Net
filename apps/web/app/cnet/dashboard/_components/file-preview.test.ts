import { describe, expect, it } from "bun:test"
import { codeLanguage, previewKind } from "./file-preview"

describe("previewKind", () => {
  it("routes HEIC before generic image", () => {
    expect(previewKind("image/heic", "photo.heic")).toBe("heic")
    expect(previewKind(null, "IMG_0001.HEIC")).toBe("heic")
    expect(previewKind("image/png", "photo.png")).toBe("image")
  })

  it("routes all Office/ODF/RTF to the office (PDF) preview", () => {
    expect(previewKind(null, "talk.pptx")).toBe("office")
    expect(previewKind(null, "report.docx")).toBe("office")
    expect(previewKind(null, "budget.xlsx")).toBe("office")
    expect(previewKind(null, "notes.odt")).toBe("office")
    expect(previewKind("application/rtf", "memo.rtf")).toBe("office")
  })

  it("routes code, text, csv, html distinctly", () => {
    expect(previewKind("text/plain", "script.py")).toBe("code")
    expect(previewKind("text/plain", "notes.txt")).toBe("text")
    expect(previewKind(null, "data.csv")).toBe("csv")
    expect(previewKind("text/html", "page.html")).toBe("html")
  })

  it("routes epub to the reader and pdf/video/audio inline", () => {
    expect(previewKind("application/epub+zip", "book.epub")).toBe("epub")
    expect(previewKind("application/pdf", "doc.pdf")).toBe("pdf")
    expect(previewKind("video/mp4", "clip.mp4")).toBe("video")
    expect(previewKind("audio/mpeg", "song.mp3")).toBe("audio")
  })

  it("falls back to none for archives and unknowns", () => {
    expect(previewKind("application/zip", "bundle.zip")).toBe("none")
    expect(previewKind("application/octet-stream", "mystery.bin")).toBe("none")
  })

  it("re-exports codeLanguage", () => {
    expect(codeLanguage("script.py")).toBe("python")
    expect(codeLanguage("notes.txt")).toBeNull()
  })
})
