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

describe("generateThumbnail", () => {
  it("honours the EXIF orientation flag so portrait shots come out upright", async () => {
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const sharp = (await import("sharp")).default
    const { generateThumbnail } = await import("./thumbnails")

    const dir = await mkdtemp(join(tmpdir(), "thumb-"))
    try {
      // A 40x20 landscape frame tagged "rotate 90° clockwise to display", as a camera held
      // in portrait writes it. Displayed correctly it is 20 wide and 40 tall.
      const src = join(dir, "portrait.jpg")
      const jpeg = await sharp({
        create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 30, b: 30 } },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer()
      await writeFile(src, jpeg)

      const result = await generateThumbnail(src, "image", "portrait.jpg")
      expect(result).not.toBeNull()
      const meta = await sharp(result?.thumb).metadata()
      // Scaled to the 256px box, but portrait: twice as tall as it is wide.
      expect((meta.height ?? 0) / (meta.width ?? 1)).toBeCloseTo(2, 1)
      expect(meta.orientation).toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
