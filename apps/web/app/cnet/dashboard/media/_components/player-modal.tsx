"use client"

import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import {
  mediaUrl,
  type Playable,
  reportProgress,
  reportStopped,
  setWatched,
  TICKS_PER_SECOND,
} from "@/lib/media-api"

/** Full-screen player: resumes at the saved position and reports progress to Jellyfin. */
export function PlayerModal({ item, onClose }: { item: Playable; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const ticks = () => Math.round(video.currentTime * TICKS_PER_SECOND)

    const onLoaded = () => {
      if (item.resumePositionTicks > 0) {
        video.currentTime = item.resumePositionTicks / TICKS_PER_SECOND
      }
      void video.play().catch(() => {})
    }
    const onPause = () => void reportProgress(item.id, ticks(), true).catch(() => {})
    const onPlaying = () => void reportProgress(item.id, ticks(), false).catch(() => {})
    const onEnded = () => {
      void setWatched(item.id, true).catch(() => {})
      onClose()
    }

    video.addEventListener("loadedmetadata", onLoaded)
    video.addEventListener("pause", onPause)
    video.addEventListener("playing", onPlaying)
    video.addEventListener("ended", onEnded)

    const heartbeat = setInterval(() => {
      if (!video.paused) void reportProgress(item.id, ticks(), false).catch(() => {})
    }, 15_000)

    return () => {
      clearInterval(heartbeat)
      void reportStopped(item.id, ticks()).catch(() => {})
      video.removeEventListener("loadedmetadata", onLoaded)
      video.removeEventListener("pause", onPause)
      video.removeEventListener("playing", onPlaying)
      video.removeEventListener("ended", onEnded)
    }
  }, [item, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="font-medium">
          {item.title}
          {item.year ? ` (${item.year})` : ""}
        </span>
        <button type="button" onClick={onClose} aria-label="Close player" className="p-1">
          <X className="h-6 w-6" />
        </button>
      </div>
      {/* biome-ignore lint/a11y/useMediaCaption: user library content, no caption track available */}
      <video
        ref={videoRef}
        src={mediaUrl(item.streamUrl)}
        controls
        autoPlay
        className="min-h-0 w-full flex-1 bg-black"
      />
    </div>
  )
}
