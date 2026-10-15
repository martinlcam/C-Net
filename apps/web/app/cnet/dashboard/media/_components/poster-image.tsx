"use client"

import { useEffect, useRef, useState } from "react"
import { mediaUrl } from "@/lib/media-api"
import { cn } from "@/lib/utils"

/**
 * Artwork that fades in once decoded, over a pulsing placeholder. Expects a `relative`
 * parent that already clips to the poster's box.
 */
export function PosterImage({
  src,
  alt,
  tone = "light",
  className,
}: {
  src: string
  alt: string
  tone?: "light" | "dark"
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // A cached image can finish before React attaches onLoad; catch that case.
  useEffect(() => {
    const img = ref.current
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  return (
    <>
      {!loaded ? (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 animate-pulse",
            tone === "dark" ? "bg-white/10" : "bg-neutral-20"
          )}
        />
      ) : null}
      {/* biome-ignore lint/performance/noImgElement: media posters are remote API URLs; next/image would need env-dependent remotePatterns */}
      <img
        ref={ref}
        src={mediaUrl(src)}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </>
  )
}
