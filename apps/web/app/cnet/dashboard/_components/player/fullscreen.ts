import { useEffect, useState } from "react"

// WebKit's prefixed fullscreen surface — iPhone Safari offers only the <video> form.
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void }
type FullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
}

export const fullscreenElement = (): Element | null => {
  const doc = document as FullscreenDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

/** Whether anything is fullscreen, kept in sync with the document (standard and WebKit events). */
export function useFullscreenState(): [boolean, (on: boolean) => void] {
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(fullscreenElement()))
    document.addEventListener("fullscreenchange", onFs)
    document.addEventListener("webkitfullscreenchange", onFs)
    return () => {
      document.removeEventListener("fullscreenchange", onFs)
      document.removeEventListener("webkitfullscreenchange", onFs)
    }
  }, [])
  return [isFullscreen, setIsFullscreen]
}

/**
 * Enter or leave fullscreen. Everything that can takes the whole container so our controls
 * stay on screen; iPhone Safari has no element fullscreen, so there only the <video> itself
 * can go fullscreen, in the native player, and `setIsFullscreen` tracks that by hand.
 */
export function toggleFullscreen(
  container: HTMLElement | null,
  video: HTMLVideoElement | null,
  setIsFullscreen: (on: boolean) => void
): void {
  const doc = document as FullscreenDocument
  const el = container as FullscreenElement | null
  const v = video as FullscreenVideo | null

  if (fullscreenElement()) {
    if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {})
    else doc.webkitExitFullscreen?.()
    return
  }
  if (v?.webkitDisplayingFullscreen) {
    v.webkitExitFullscreen?.()
    return
  }

  const enterNativeVideoFullscreen = () => {
    if (!v?.webkitEnterFullscreen) return
    v.addEventListener("webkitendfullscreen", () => setIsFullscreen(false), { once: true })
    v.webkitEnterFullscreen()
    setIsFullscreen(true)
  }
  if (el?.requestFullscreen) {
    el.requestFullscreen().catch(enterNativeVideoFullscreen)
  } else if (el?.webkitRequestFullscreen) {
    el.webkitRequestFullscreen()
  } else {
    enterNativeVideoFullscreen()
  }
}
