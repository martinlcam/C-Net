// File-type detection for the fullscreen preview. Routing is MIME-first with an
// extension fallback, so files uploaded with a generic octet-stream still preview.

function normalize(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase()
}

function ext(filename: string): string {
  const lower = filename.toLowerCase()
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : ""
}

export function isImageFile(contentType: string | null): boolean {
  return normalize(contentType).startsWith("image/")
}

export function isVideoFile(contentType: string | null, filename: string): boolean {
  if (normalize(contentType).startsWith("video/")) return true
  return [".mp4", ".webm", ".ogv", ".mov", ".m4v"].includes(ext(filename))
}

export function isAudioFile(contentType: string | null, filename: string): boolean {
  if (normalize(contentType).startsWith("audio/")) return true
  return [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".flac", ".aac"].includes(ext(filename))
}

export function isPdfFile(contentType: string | null, filename: string): boolean {
  return normalize(contentType) === "application/pdf" || ext(filename) === ".pdf"
}

const HTML_MIME = new Set(["text/html", "application/xhtml+xml"])
const HTML_EXT = new Set([".html", ".htm", ".xhtml"])

export function isHtmlFile(contentType: string | null, filename: string): boolean {
  if (HTML_MIME.has(normalize(contentType))) return true
  return HTML_EXT.has(ext(filename))
}

const PLAINTEXT_MIME = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/x-sh",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/sql",
  "application/graphql",
  "application/ld+json",
])

const PLAINTEXT_EXT = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".rb",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".cc",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".kt",
  ".lua",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".sql",
  ".graphql",
  ".gql",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".csv",
  ".tsv",
  ".xml",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".svg",
  ".log",
  ".php",
  ".dockerfile",
  ".makefile",
  ".tf",
  ".hcl",
  ".proto",
  ".gradle",
])

export function isPlaintextFile(contentType: string | null, filename: string): boolean {
  const mime = normalize(contentType)
  if (mime.startsWith("text/")) return true
  if (PLAINTEXT_MIME.has(mime)) return true
  return PLAINTEXT_EXT.has(ext(filename))
}

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "html" | "text" | "none"

export function previewKind(contentType: string | null, filename: string): PreviewKind {
  if (isImageFile(contentType)) return "image"
  if (isPdfFile(contentType, filename)) return "pdf"
  if (isVideoFile(contentType, filename)) return "video"
  if (isAudioFile(contentType, filename)) return "audio"
  if (isHtmlFile(contentType, filename)) return "html"
  if (isPlaintextFile(contentType, filename)) return "text"
  return "none"
}
