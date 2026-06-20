import { spawn } from "node:child_process"
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Vault files are stored on disk keyed by uuid with NO extension, but LibreOffice and
// HEIC decoders infer the input format from the extension. So every conversion copies
// the source into a temp file carrying the correct extension first, then cleans up.

/** Run a binary to completion. Resolves true on exit code 0, false on error/missing. */
function run(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(cmd, args)
    } catch {
      resolve(false)
      return
    }
    child.on("error", () => resolve(false)) // ENOENT: binary not installed
    child.on("close", (code) => resolve(code === 0))
  })
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "cnet-convert-"))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Convert an Office/ODF/RTF document to PDF via LibreOffice headless, or null if the
 * tooling is missing or conversion fails. `ext` is the source extension incl. dot
 * (e.g. ".docx") used to seed format detection.
 */
export async function officeToPdf(sourcePath: string, ext: string): Promise<Buffer | null> {
  return withTempDir(async (dir) => {
    const input = join(dir, `in${ext}`)
    await copyFile(sourcePath, input)
    // A per-invocation profile dir keeps concurrent soffice runs from colliding and
    // avoids needing a writable $HOME in the read-only container image.
    const ok = await run("soffice", [
      "--headless",
      "--norestore",
      `-env:UserInstallation=file://${join(dir, "profile")}`,
      "--convert-to",
      "pdf",
      "--outdir",
      dir,
      input,
    ])
    if (!ok) return null
    try {
      return await readFile(join(dir, "in.pdf"))
    } catch {
      return null
    }
  })
}

/**
 * Decode a HEIC/HEIF image to PNG via libheif's heif-convert, or null on failure.
 * Used because sharp's prebuilt binaries ship without libheif support.
 */
export async function heicToPng(sourcePath: string): Promise<Buffer | null> {
  return withTempDir(async (dir) => {
    const input = join(dir, "in.heic")
    const output = join(dir, "out.png")
    await copyFile(sourcePath, input)
    const ok = await run("heif-convert", [input, output])
    if (!ok) return null
    try {
      return await readFile(output)
    } catch {
      return null
    }
  })
}
