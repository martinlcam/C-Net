"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { CloudAlert, Download, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type VaultFile, vaultUrl } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import { previewKind } from "./file-preview"
import { formatBytes } from "./format"
import { SyntaxCodePreview } from "./syntax-code-preview"

/** Fetches a text/code file's contents for inline display. */
function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setError(null)
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
        return res.text()
      })
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <PreviewMessage>{error}</PreviewMessage>
  if (content === null) return <PreviewMessage>Loading preview…</PreviewMessage>

  return (
    <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-white p-4 font-mono text-neutral-100 text-xs">
      {content}
    </pre>
  )
}

function HtmlPreview({ url, filename }: { url: string; filename: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [mode, setMode] = useState<"preview" | "source">("preview")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
        return res.text()
      })
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <PreviewMessage>{error}</PreviewMessage>
  if (content === null) return <PreviewMessage>Loading preview…</PreviewMessage>

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-neutral-20 border-b px-2 py-1.5">
        {(["preview", "source"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 font-medium text-xs transition-colors ${
              mode === m
                ? "bg-neutral-10 text-neutral-100"
                : "text-neutral-60 hover:text-neutral-100"
            }`}
          >
            {m === "preview" ? "Preview" : "Source"}
          </button>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden">
        {mode === "preview" ? (
          <iframe
            srcDoc={content}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 bg-white"
            title={`Preview of ${filename}`}
          />
        ) : (
          <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-white p-4 font-mono text-neutral-100 text-xs">
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}

function PreviewMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-neutral-60">
      <CloudAlert className="h-8 w-8" />
      <p className="text-sm">{children}</p>
    </div>
  )
}

/** HEIC/HEIF — convert client-side since most browsers cannot render them in <img>. */
function HeicPreview({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    setSrc(null)
    setError(null)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
        return res.blob()
      })
      .then(async (blob) => {
        const { default: heic2any } = await import("heic2any")
        const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 })
        const out = Array.isArray(converted) ? converted[0] : converted
        if (cancelled) return
        objectUrl = URL.createObjectURL(out)
        setSrc(objectUrl)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  if (error) return <PreviewMessage>{error}</PreviewMessage>
  if (!src) return <PreviewMessage>Converting HEIC preview…</PreviewMessage>

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
      {/* biome-ignore lint/performance/noImgElement: converted blob URL from heic2any */}
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  )
}

function PptxPreview({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<{ destroy: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return

    setLoading(true)
    setError(null)
    host.innerHTML = ""

    import("pptx-preview")
      .then(({ init }) => {
        if (cancelled || !hostRef.current) return
        const width = Math.min(hostRef.current.clientWidth || 960, 960)
        const height = Math.round((width * 9) / 16)
        const viewer = init(hostRef.current, { width, height, mode: "slide" })
        viewerRef.current = viewer
        return fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
            return res.arrayBuffer()
          })
          .then((buffer) => viewer.preview(buffer))
      })
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [url])

  if (error) return <PreviewMessage>{error}</PreviewMessage>

  return (
    <div className="relative h-full w-full overflow-auto bg-neutral-20 p-4">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-neutral-60 text-sm">
          Loading presentation…
        </div>
      ) : null}
      <div ref={hostRef} className="mx-auto h-full" />
    </div>
  )
}

function PreviewBody({ file }: { file: VaultFile }) {
  const url = vaultUrl(file.previewUrl)
  const kind = previewKind(file.contentType, file.filename)

  switch (kind) {
    case "image":
      return (
        <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
          {/* biome-ignore lint/performance/noImgElement: signed cross-origin URL, not a static asset */}
          <img src={url} alt={file.filename} className="max-h-full max-w-full object-contain" />
        </div>
      )
    case "heic":
      return <HeicPreview url={url} alt={file.filename} />
    case "pdf":
      return (
        <object
          data={`${url}#navpanes=0&view=FitH`}
          type="application/pdf"
          className="h-full w-full"
          title={`Preview of ${file.filename}`}
        >
          <iframe
            src={url}
            className="h-full w-full border-0"
            title={`Preview of ${file.filename}`}
          />
        </object>
      )
    case "pptx":
      return <PptxPreview url={url} />
    case "video":
      return (
        <div className="flex h-full w-full items-center justify-center bg-black p-2">
          {/** biome-ignore lint/a11y/useMediaCaption: user-uploaded media has no track */}
          <video src={url} controls className="max-h-full max-w-full" />
        </div>
      )
    case "audio":
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          {/** biome-ignore lint/a11y/useMediaCaption: user-uploaded media has no track */}
          <audio src={url} controls className="w-full max-w-lg" />
        </div>
      )
    case "html":
      return <HtmlPreview url={url} filename={file.filename} />
    case "code":
      return <SyntaxCodePreview url={url} filename={file.filename} contentType={file.contentType} />
    case "text":
      return <TextPreview url={url} />
    default:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-neutral-60">
          <CloudAlert className="h-8 w-8" />
          <p className="text-sm">No preview available for this file type.</p>
          <p className="text-xs">Download the file to open it in another app.</p>
        </div>
      )
  }
}

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: VaultFile | null
  onClose: () => void
}) {
  return (
    <DialogPrimitive.Root open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 flex h-[88vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-neutral-30 bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {file ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-neutral-20 border-b px-4 py-3">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="truncate font-semibold text-neutral-100 text-sm">
                    {file.filename}
                  </DialogPrimitive.Title>
                  <p className="text-neutral-60 text-xs">{formatBytes(file.size)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a href={vaultUrl(file.downloadUrl)} download={file.filename}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Close">
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden bg-neutral-10">
                <PreviewBody file={file} />
              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
