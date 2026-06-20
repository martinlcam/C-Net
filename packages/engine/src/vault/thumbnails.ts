import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { classifyFile, isServerThumbClass } from "@cnet/core"
import sharp from "sharp"
import { heicToPng, officeToPdf, withTempDir } from "./convert"

export type ThumbnailKind = "image" | "heic" | "pdf" | "video" | "office"

/** A produced thumbnail, plus the cached render PDF for Office docs (so the worker can
 * persist it for fullscreen preview). */
export type ThumbnailResult = { thumb: Buffer; pdf?: Buffer }

/** Decide which generator handles a file, or null to skip. */
export function pickGenerator(contentType: string, filename: string): ThumbnailKind | null {
  const c = classifyFile(contentType, filename)
  return isServerThumbClass(c) ? (c as ThumbnailKind) : null
}

const THUMB_SIZE = 256

async function toWebp(input: Buffer): Promise<Buffer> {
  return sharp(input).resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside" }).webp().toBuffer()
}

/** Run a binary, return its stdout buffer, or null if it is missing or fails. */
function runCapture(cmd: string, args: string[]): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(cmd, args)
    } catch {
      resolve(null)
      return
    }
    const out: Buffer[] = []
    child.stdout?.on("data", (d: Buffer) => out.push(d))
    child.on("error", () => resolve(null)) // ENOENT: binary not installed
    child.on("close", (code) => {
      if (code === 0 && out.length > 0) resolve(Buffer.concat(out))
      else resolve(null)
    })
  })
}

/** Render the first page of a PDF (on disk) to a 256px webp, or null on failure. */
async function pdfFileToWebp(pdfPath: string): Promise<Buffer | null> {
  const png = await runCapture("pdftoppm", ["-png", "-singlefile", "-r", "72", pdfPath])
  return png ? await toWebp(png) : null
}

/**
 * Produce a 256px webp thumbnail (and, for Office docs, the intermediate render PDF) for
 * the source file, or null if the format is unsupported or required tooling
 * (pdftoppm/ffmpeg/soffice/heif-convert) is unavailable. `filename` carries the original
 * extension, which Office conversion needs since on-disk files are extension-less.
 */
export async function generateThumbnail(
  sourcePath: string,
  kind: ThumbnailKind,
  filename: string
): Promise<ThumbnailResult | null> {
  try {
    if (kind === "image") {
      const thumb = await sharp(sourcePath)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside" })
        .webp()
        .toBuffer()
      return { thumb }
    }
    if (kind === "heic") {
      const png = await heicToPng(sourcePath)
      return png ? { thumb: await toWebp(png) } : null
    }
    if (kind === "pdf") {
      const thumb = await pdfFileToWebp(sourcePath)
      return thumb ? { thumb } : null
    }
    if (kind === "office") {
      const ext = extname(filename).toLowerCase() || ".bin"
      const pdf = await officeToPdf(sourcePath, ext)
      if (!pdf) return null
      const thumb = await withTempDir(async (dir) => {
        const pdfPath = join(dir, "render.pdf")
        await writeFile(pdfPath, pdf)
        return pdfFileToWebp(pdfPath)
      })
      return thumb ? { thumb, pdf } : null
    }
    // video: grab the first frame as PNG on stdout
    const png = await runCapture("ffmpeg", [
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-",
    ])
    return png ? { thumb: await toWebp(png) } : null
  } catch {
    return null
  }
}
