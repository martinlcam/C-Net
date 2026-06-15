"use client"

import { File as FileIcon, FileText, Film, ImageIcon, Music } from "lucide-react"
import { useState } from "react"
import { type VaultFile, vaultUrl } from "@/lib/vault-api"

function TypeIcon({ contentType }: { contentType: string }) {
  const ct = contentType.toLowerCase()
  const cls = "h-10 w-10 text-neutral-50"
  if (ct.startsWith("image/")) return <ImageIcon className={cls} />
  if (ct.startsWith("video/")) return <Film className={cls} />
  if (ct.startsWith("audio/")) return <Music className={cls} />
  if (ct === "application/pdf" || ct.startsWith("text/")) return <FileText className={cls} />
  return <FileIcon className={cls} />
}

/**
 * Drive-style preview tile. Tries the generated thumbnail, falls back to the
 * inline image for image files, then to a type icon.
 */
export function FileThumb({ file }: { file: VaultFile }) {
  const isImage = file.contentType.toLowerCase().startsWith("image/")
  const candidates: string[] = []
  if (file.thumbKey) candidates.push(vaultUrl(file.thumbUrl))
  if (isImage) candidates.push(vaultUrl(file.previewUrl))

  const [idx, setIdx] = useState(0)
  const src = candidates[idx]

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-10">
        <TypeIcon contentType={file.contentType} />
      </div>
    )
  }
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
