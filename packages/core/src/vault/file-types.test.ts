import { describe, expect, test } from "bun:test"
import { classifyFile, codeLanguage, type FileClass, isServerThumbClass } from "./file-types"

describe("classifyFile", () => {
  const cases: [string | null, string, FileClass][] = [
    // images vs heic (heic wins)
    ["image/png", "a.png", "image"],
    ["image/svg+xml", "logo.svg", "image"],
    ["image/heic", "IMG_1.heic", "heic"],
    ["image/heif", "IMG_1.heif", "heic"],
    [null, "photo.HEIC", "heic"],
    // pdf
    ["application/pdf", "doc.pdf", "pdf"],
    [null, "doc.pdf", "pdf"],
    // office: openxml, legacy, odf, rtf
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "deck.pptx",
      "office",
    ],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx", "office"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx", "office"],
    ["application/msword", "old.doc", "office"],
    ["application/vnd.ms-excel", "old.xls", "office"],
    [null, "slides.ppt", "office"],
    ["application/vnd.oasis.opendocument.text", "a.odt", "office"],
    [null, "sheet.ods", "office"],
    ["application/rtf", "memo.rtf", "office"],
    // epub
    ["application/epub+zip", "book.epub", "epub"],
    [null, "book.epub", "epub"],
    // av
    ["video/mp4", "clip.mp4", "video"],
    [null, "clip.mov", "video"],
    ["audio/mpeg", "song.mp3", "audio"],
    [null, "song.flac", "audio"],
    // csv before text
    [null, "data.csv", "csv"],
    ["text/csv", "data.csv", "csv"],
    [null, "data.tsv", "csv"],
    // html
    ["text/html", "page.html", "html"],
    [null, "page.htm", "html"],
    // code before text
    [null, "main.py", "code"],
    [null, "app.tsx", "code"],
    ["application/json", "pkg.json", "code"],
    [null, "config.yaml", "code"],
    // archive
    ["application/zip", "bundle.zip", "archive"],
    [null, "bundle.7z", "archive"],
    // plain text
    ["text/plain", "notes.txt", "text"],
    [null, "server.log", "text"],
    [null, ".env", "text"],
    // unknown
    ["application/octet-stream", "mystery.bin", "none"],
    [null, "noext", "none"],
  ]

  for (const [ct, name, expected] of cases) {
    test(`${ct ?? "null"} / ${name} -> ${expected}`, () => {
      expect(classifyFile(ct, name)).toBe(expected)
    })
  }
})

describe("codeLanguage", () => {
  test("maps known extensions", () => {
    expect(codeLanguage("main.py")).toBe("python")
    expect(codeLanguage("a.tsx")).toBe("tsx")
    expect(codeLanguage("readme.md")).toBe("markdown")
  })
  test("null for non-code", () => {
    expect(codeLanguage("notes.txt")).toBeNull()
    expect(codeLanguage("photo.png")).toBeNull()
  })
})

describe("isServerThumbClass", () => {
  test("server-generated classes", () => {
    for (const c of ["image", "heic", "pdf", "video", "office"] as FileClass[]) {
      expect(isServerThumbClass(c)).toBe(true)
    }
  })
  test("client/icon classes", () => {
    for (const c of ["code", "text", "csv", "audio", "epub", "archive", "none"] as FileClass[]) {
      expect(isServerThumbClass(c)).toBe(false)
    }
  })
})
