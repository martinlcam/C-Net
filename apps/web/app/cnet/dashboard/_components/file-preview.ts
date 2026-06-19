// File-type detection for the fullscreen preview. Routing is MIME-first with an
// extension fallback, so files uploaded with a generic octet-stream still preview.

function normalize(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase()
}

function ext(filename: string): string {
  const lower = filename.toLowerCase()
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : ""
}

export function isImageFile(contentType: string | null, filename?: string): boolean {
  if (isHeicFile(contentType, filename ?? "")) return false
  return normalize(contentType).startsWith("image/")
}

const HEIC_MIME = new Set(["image/heic", "image/heif"])
const HEIC_EXT = new Set([".heic", ".heif"])

export function isHeicFile(contentType: string | null, filename: string): boolean {
  if (HEIC_MIME.has(normalize(contentType))) return true
  return HEIC_EXT.has(ext(filename))
}

const PPTX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
])

export function isPptxFile(contentType: string | null, filename: string): boolean {
  if (PPTX_MIME.has(normalize(contentType))) return true
  return ext(filename) === ".pptx"
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

/** Prism language id for syntax-highlighted code previews, or null for plain text. */
const CODE_LANG: Record<string, string> = {
  ".py": "python",
  ".js": "javascript",
  ".jsx": "jsx",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".rb": "ruby",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".lua": "lua",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".fish": "bash",
  ".ps1": "powershell",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".php": "php",
  ".json": "json",
  ".xml": "markup",
  ".tf": "hcl",
  ".hcl": "hcl",
  ".proto": "protobuf",
  ".md": "markdown",
  ".markdown": "markdown",
}

export function codeLanguage(filename: string): string | null {
  return CODE_LANG[ext(filename)] ?? null
}

export function isCodeFile(contentType: string | null, filename: string): boolean {
  if (codeLanguage(filename)) return true
  const mime = normalize(contentType)
  return (
    mime === "application/json" ||
    mime === "application/javascript" ||
    mime === "application/x-javascript"
  )
}

export function isPlaintextFile(contentType: string | null, filename: string): boolean {
  const mime = normalize(contentType)
  if (mime.startsWith("text/")) return true
  if (PLAINTEXT_MIME.has(mime)) return true
  return PLAINTEXT_EXT.has(ext(filename))
}

export type PreviewKind =
  | "image"
  | "heic"
  | "pdf"
  | "pptx"
  | "video"
  | "audio"
  | "html"
  | "code"
  | "text"
  | "none"

export function previewKind(contentType: string | null, filename: string): PreviewKind {
  if (isHeicFile(contentType, filename)) return "heic"
  if (isImageFile(contentType, filename)) return "image"
  if (isPdfFile(contentType, filename)) return "pdf"
  if (isPptxFile(contentType, filename)) return "pptx"
  if (isVideoFile(contentType, filename)) return "video"
  if (isAudioFile(contentType, filename)) return "audio"
  if (isHtmlFile(contentType, filename)) return "html"
  if (isCodeFile(contentType, filename)) return "code"
  if (isPlaintextFile(contentType, filename)) return "text"
  return "none"
}
