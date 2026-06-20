// Shared file-type classification for the vault, used by the web preview/thumb UI,
// the engine thumbnail worker, and the API backfill. MIME-first with an extension
// fallback so files uploaded as octet-stream still classify.

export type FileClass =
  | "image"
  | "heic"
  | "pdf"
  | "office"
  | "video"
  | "audio"
  | "html"
  | "code"
  | "text"
  | "csv"
  | "epub"
  | "archive"
  | "none"

function normalize(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase()
}

function ext(filename: string): string {
  const lower = filename.toLowerCase()
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : ""
}

const HEIC_MIME = new Set(["image/heic", "image/heif"])
const HEIC_EXT = new Set([".heic", ".heif"])

const OFFICE_MIME = new Set([
  // OpenXML
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  // Legacy binary
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  // OpenDocument
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  // RTF
  "application/rtf",
  "text/rtf",
])
const OFFICE_EXT = new Set([
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
])

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogv", ".mov", ".m4v"])
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".oga", ".m4a", ".flac", ".aac"])
const HTML_MIME = new Set(["text/html", "application/xhtml+xml"])
const HTML_EXT = new Set([".html", ".htm", ".xhtml"])
const CSV_EXT = new Set([".csv", ".tsv"])
const EPUB_MIME = new Set(["application/epub+zip"])
const ARCHIVE_MIME = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-gzip",
  "application/x-bzip2",
])
const ARCHIVE_EXT = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".tgz",
  ".bz2",
  ".xz",
])

// Code extensions → Prism language id. The keys double as the code-class membership
// test; consumers that don't syntax-highlight just use `codeLanguage(...) !== null`.
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

const CODE_MIME = new Set([
  "application/json",
  "application/javascript",
  "application/x-javascript",
])

// Plaintext that is not code: notes, configs, logs, plain data.
const TEXT_MIME = new Set([
  "application/xml",
  "application/x-sh",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/sql",
  "application/graphql",
  "application/ld+json",
])
const TEXT_EXT = new Set([
  ".txt",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".log",
  ".svg",
  ".dockerfile",
  ".makefile",
  ".gradle",
])

/** Prism language id for a code file, or null if it is not a recognized code type. */
export function codeLanguage(filename: string): string | null {
  return CODE_LANG[ext(filename)] ?? null
}

/**
 * Classify a file into a single render class. Order matters: more specific MIME/ext
 * groups (heic before image, office before anything, code before text) win.
 */
export function classifyFile(contentType: string | null, filename: string): FileClass {
  const mime = normalize(contentType)
  const e = ext(filename)

  if (HEIC_MIME.has(mime) || HEIC_EXT.has(e)) return "heic"
  if (mime.startsWith("image/")) return "image"
  if (mime === "application/pdf" || e === ".pdf") return "pdf"
  if (OFFICE_MIME.has(mime) || OFFICE_EXT.has(e)) return "office"
  if (EPUB_MIME.has(mime) || e === ".epub") return "epub"
  if (mime.startsWith("video/") || VIDEO_EXT.has(e)) return "video"
  if (mime.startsWith("audio/") || AUDIO_EXT.has(e)) return "audio"
  if (CSV_EXT.has(e)) return "csv"
  if (HTML_MIME.has(mime) || HTML_EXT.has(e)) return "html"
  if (CODE_LANG[e] || CODE_MIME.has(mime)) return "code"
  if (ARCHIVE_MIME.has(mime) || ARCHIVE_EXT.has(e)) return "archive"
  if (mime.startsWith("text/") || TEXT_MIME.has(mime) || TEXT_EXT.has(e)) return "text"
  return "none"
}

/** Classes whose thumbnails are produced server-side as a webp derivative. */
export function isServerThumbClass(c: FileClass): boolean {
  return c === "image" || c === "heic" || c === "pdf" || c === "video" || c === "office"
}
