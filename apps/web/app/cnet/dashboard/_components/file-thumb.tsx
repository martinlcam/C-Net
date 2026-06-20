"use client"

import { classifyFile, type FileClass } from "@cnet/core/vault/file-types"
import { Archive, BookOpen, File as FileIcon, FileText, Film, ImageIcon, Music } from "lucide-react"
import { type RefObject, useEffect, useRef, useState } from "react"
import { type VaultFile, vaultUrl } from "@/lib/vault-api"

const SNIPPET_CLASSES: ReadonlySet<FileClass> = new Set(["code", "text", "csv", "html"])

function TypeIcon({ fileClass }: { fileClass: FileClass }) {
  const cls = "h-10 w-10 text-neutral-50"
  switch (fileClass) {
    case "image":
    case "heic":
      return <ImageIcon className={cls} />
    case "video":
      return <Film className={cls} />
    case "audio":
      return <Music className={cls} />
    case "epub":
      return <BookOpen className={cls} />
    case "archive":
      return <Archive className={cls} />
    case "pdf":
    case "office":
    case "code":
    case "text":
    case "csv":
    case "html":
      return <FileText className={cls} />
    default:
      return <FileIcon className={cls} />
  }
}

function IconTile({ fileClass }: { fileClass: FileClass }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-10">
      <TypeIcon fileClass={fileClass} />
    </div>
  )
}

/** True once the element has scrolled near the viewport (latches, never resets). */
function useOnScreen<T extends Element>(ref: RefObject<T | null>): boolean {
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || onScreen) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setOnScreen(true)
      },
      { rootMargin: "150px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref, onScreen])
  return onScreen
}

/** Read only the first bytes of a URL, cancelling the stream early — no Range header
 * (keeps the request CORS-simple) and no full download for big files. */
async function fetchPrefix(url: string, maxBytes: number, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal })
  if (!res.ok && res.status !== 206) throw new Error(`status ${res.status}`)
  const reader = res.body?.getReader()
  if (!reader) return (await res.text()).slice(0, maxBytes)
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      total += value.length
    }
  }
  await reader.cancel().catch(() => {})
  const buf = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    buf.set(c, offset)
    offset += c.length
  }
  return new TextDecoder().decode(buf)
}

/** Live in-tile snippet for code/text/csv/html — fetched lazily once on-screen. */
function SnippetTile({ file, fileClass }: { file: VaultFile; fileClass: FileClass }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(ref)
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!visible || text !== null || failed) return
    const ctrl = new AbortController()
    fetchPrefix(vaultUrl(file.previewUrl), 2048, ctrl.signal)
      .then((t) => setText(t))
      .catch((err) => {
        if (!ctrl.signal.aborted) setFailed(true)
        void err
      })
    return () => ctrl.abort()
  }, [visible, file.previewUrl, text, failed])

  return (
    <div ref={ref} className="h-full w-full overflow-hidden bg-neutral-10">
      {failed ? (
        <IconTile fileClass={fileClass} />
      ) : text === null ? null : (
        <pre className="h-full w-full overflow-hidden whitespace-pre-wrap break-all p-1.5 font-mono text-[6px] text-neutral-70 leading-[1.35]">
          {text}
        </pre>
      )}
    </div>
  )
}

/** Generated webp (image/heic/pdf/video/office) with an inline-original fallback for
 * plain images that have no thumbnail yet, then a type icon. */
function ThumbImage({ file, fileClass }: { file: VaultFile; fileClass: FileClass }) {
  const candidates: string[] = []
  if (file.thumbKey) candidates.push(vaultUrl(file.thumbUrl))
  if (fileClass === "image") candidates.push(vaultUrl(file.previewUrl))

  const [idx, setIdx] = useState(0)
  const src = candidates[idx]

  if (!src) return <IconTile fileClass={fileClass} />
  return (
    // biome-ignore lint/performance/noImgElement: signed cross-origin URL, not a static asset
    <img
      src={src}
      alt={file.filename}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
    />
  )
}

/**
 * Drive-style preview tile. Prefers the server-generated thumbnail, falls back to an
 * inline image for plain images, a live snippet for text/code, then a type icon.
 */
export function FileThumb({ file }: { file: VaultFile }) {
  const fileClass = classifyFile(file.contentType, file.filename)

  if (file.thumbKey || fileClass === "image") {
    return <ThumbImage file={file} fileClass={fileClass} />
  }
  if (SNIPPET_CLASSES.has(fileClass)) {
    return <SnippetTile file={file} fileClass={fileClass} />
  }
  return <IconTile fileClass={fileClass} />
}
