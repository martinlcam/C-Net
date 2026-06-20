// Fullscreen-preview routing. Thin wrapper over the shared @cnet/core classifier so the
// web UI and the server thumbnail worker agree on file types. Imported via the pure
// subpath (not the @cnet/core barrel) to keep node-only deps out of the client bundle.

import { classifyFile, codeLanguage, type FileClass } from "@cnet/core/vault/file-types"

export { codeLanguage }

// Every class can be previewed inline except archives, which fall through to a
// download-only message.
export type PreviewKind = Exclude<FileClass, "archive">

export function previewKind(contentType: string | null, filename: string): PreviewKind {
  const c = classifyFile(contentType, filename)
  return c === "archive" ? "none" : c
}
