import { spawn } from "node:child_process"
import sharp from "sharp"

export type ThumbnailKind = "image" | "pdf" | "video"

/** Decide which generator handles a content type, or null to skip. */
export function pickGenerator(contentType: string): ThumbnailKind | null {
  const ct = contentType.toLowerCase()
  if (ct.startsWith("image/")) return "image"
  if (ct === "application/pdf") return "pdf"
  if (ct.startsWith("video/")) return "video"
  return null
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

/**
 * Produce a 256px webp thumbnail for the source file, or null if the format is
 * unsupported or the required tooling (pdftoppm/ffmpeg) is unavailable.
 */
export async function generateThumbnail(
  sourcePath: string,
  kind: ThumbnailKind
): Promise<Buffer | null> {
  try {
    if (kind === "image") {
      return await sharp(sourcePath)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside" })
        .webp()
        .toBuffer()
    }
    if (kind === "pdf") {
      const png = await runCapture("pdftoppm", ["-png", "-singlefile", "-r", "72", sourcePath])
      return png ? await toWebp(png) : null
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
    return png ? await toWebp(png) : null
  } catch {
    return null
  }
}
