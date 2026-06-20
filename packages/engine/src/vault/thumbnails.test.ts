import { describe, expect, it } from "bun:test"
import { pickGenerator } from "./thumbnails"

describe("pickGenerator", () => {
  it("maps image content types", () => {
    expect(pickGenerator("image/png", "a.png")).toBe("image")
    expect(pickGenerator("IMAGE/JPEG", "a.jpg")).toBe("image")
  })
  it("maps pdf", () => {
    expect(pickGenerator("application/pdf", "doc.pdf")).toBe("pdf")
  })
  it("maps video", () => {
    expect(pickGenerator("video/mp4", "clip.mp4")).toBe("video")
  })
  it("maps heic", () => {
    expect(pickGenerator("image/heic", "IMG.heic")).toBe("heic")
    expect(pickGenerator("application/octet-stream", "IMG.HEIC")).toBe("heic")
  })
  it("maps office (openxml, legacy, odf, rtf)", () => {
    expect(
      pickGenerator(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "deck.pptx"
      )
    ).toBe("office")
    expect(pickGenerator("application/octet-stream", "report.docx")).toBe("office")
    expect(pickGenerator("application/octet-stream", "sheet.ods")).toBe("office")
    expect(pickGenerator("application/rtf", "memo.rtf")).toBe("office")
  })
  it("returns null for unsupported types", () => {
    expect(pickGenerator("text/plain", "notes.txt")).toBeNull()
    expect(pickGenerator("application/zip", "a.zip")).toBeNull()
    expect(pickGenerator("text/x-python", "main.py")).toBeNull()
  })
})
