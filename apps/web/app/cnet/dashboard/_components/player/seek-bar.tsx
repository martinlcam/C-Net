"use client"

import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"

/** A grid of scrub-preview thumbnails, `tileWidth × tileHeight` per sheet, one every `intervalSeconds`. */
export type Trickplay = {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  thumbnailCount: number
  intervalSeconds: number
}

export function fmtTime(input: number): string {
  const s = Number.isFinite(input) && input > 0 ? input : 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
}

// Rendered width of a scrub-preview thumbnail; Jellyfin's tiles are 320px wide, so this
// is a downscale on both and never a blurry upscale.
const PREVIEW_W = { phone: 128, desktop: 192 } as const

/**
 * Where the thumbnail for time `t` lives. Sheets are `tileWidth × tileHeight` grids of
 * consecutive thumbnails `intervalSeconds` apart, so a frame is addressed by sheet
 * number, then row and column within the sheet.
 */
export function frameFor(t: number, trickplay: Trickplay) {
  const perSheet = trickplay.tileWidth * trickplay.tileHeight
  const idx = Math.min(
    Math.max(0, trickplay.thumbnailCount - 1),
    Math.max(0, Math.floor(t / trickplay.intervalSeconds))
  )
  const within = idx % perSheet
  return {
    sheet: Math.floor(idx / perSheet),
    col: within % trickplay.tileWidth,
    row: Math.floor(within / trickplay.tileWidth),
  }
}

function ScrubThumb({
  t,
  trickplay,
  sheetUrl,
  width,
}: {
  t: number
  trickplay: Trickplay
  sheetUrl: string
  width: number
}) {
  const height = Math.round((trickplay.height * width) / trickplay.width)
  const { col, row } = frameFor(t, trickplay)
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        backgroundImage: `url("${sheetUrl}")`,
        backgroundPosition: `-${col * width}px -${row * height}px`,
        backgroundSize: `${trickplay.tileWidth * width}px ${trickplay.tileHeight * height}px`,
      }}
      className="rounded bg-neutral-800 bg-no-repeat"
    />
  )
}

// The preview bubble grows out of the bar (transform origin is its bottom edge), swells
// a touch more while a finger or button is held on the scrubber, and shrinks back into
// the bar on release. Centering on the pointer is part of the motion transform (`x`)
// because framer owns `transform` here, so a Tailwind translate class would be lost.
const bubbleSpring = { type: "spring", stiffness: 640, damping: 26, mass: 0.6 } as const
const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 10, x: "-50%", scale: 0.35 },
  show: { opacity: 1, y: 0, x: "-50%", scale: 1, transition: bubbleSpring },
  held: { opacity: 1, y: -4, x: "-50%", scale: 1.08, transition: bubbleSpring },
  exit: {
    opacity: 0,
    y: 10,
    x: "-50%",
    scale: 0.35,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
}
// A thumbnail arrives a beat after the bubble (its sheet has to load), so it fades in
// on its own rather than popping in and shoving the time label down.
const thumbVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

type SheetState = "loading" | "ok" | "missing"

/**
 * Loads trickplay sheets ahead of the preview and remembers which ones exist. Jellyfin
 * advertises an item's grid as soon as the library has trickplay switched on, hours
 * before its extraction task has actually written the JPEGs — so the picture is shown
 * only once a sheet has really loaded, and never as a grey box over a 404.
 */
function useSheets() {
  const states = useRef(new Map<string, SheetState>())
  const [, bump] = useState(0)
  const ensure = useCallback((url: string): SheetState => {
    const known = states.current.get(url)
    if (known) return known
    states.current.set(url, "loading")
    const img = new Image()
    img.onload = () => {
      states.current.set(url, "ok")
      bump((n) => n + 1)
    }
    img.onerror = () => {
      states.current.set(url, "missing")
      bump((n) => n + 1)
    }
    img.src = url
    return "loading"
  }, [])
  return ensure
}

/**
 * Scrubber with a seek preview. Hovering (mouse) or holding (touch) over the bar floats
 * a bubble above the pointer with the time you would land on, plus a thumbnail when the
 * source has trickplay sheets; while dragging, the seek itself is deferred to release so
 * a long drag doesn't start a transcode at every pixel along the way.
 */
export function SeekBar({
  current,
  duration,
  trickplay = null,
  sheetUrl,
  mobile,
  onSeek,
  onScrubbing,
}: {
  current: number
  duration: number
  trickplay?: Trickplay | null
  sheetUrl?: (sheet: number) => string
  mobile: boolean
  onSeek: (t: number) => void
  onScrubbing: (active: boolean) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  // Time under the pointer while hovering or dragging; null when neither.
  const [preview, setPreview] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const pendingRef = useRef<number | null>(null)

  const timeAtX = useCallback(
    (clientX: number) => {
      const el = wrapRef.current
      if (!el || duration <= 0) return 0
      const r = el.getBoundingClientRect()
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration
    },
    [duration]
  )

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    onScrubbing(false)
    if (pendingRef.current != null) onSeek(pendingRef.current)
    pendingRef.current = null
    // A finger lifts off; a mouse stays and keeps hovering.
    if (mobile) setPreview(null)
  }, [mobile, onSeek, onScrubbing])

  // Release can land anywhere on the page, so the drag ends on the window, not the
  // input. The slider is `touch-none` so the browser never turns a finger drag into a
  // scroll (which would cancel the pointer mid-hold and drop the preview).
  useEffect(() => {
    if (!dragging) return
    const evts = ["pointerup", "touchend", "touchcancel"] as const
    for (const e of evts) window.addEventListener(e, endDrag)
    return () => {
      for (const e of evts) window.removeEventListener(e, endDrag)
    }
  }, [dragging, endDrag])

  const sheetState = useSheets()
  // Warm the first sheet so the very first hover shows a picture straight away.
  const firstSheet = trickplay && sheetUrl ? sheetUrl(0) : null
  useEffect(() => {
    if (firstSheet) sheetState(firstSheet)
  }, [firstSheet, sheetState])

  const shown = dragging && preview != null ? preview : current
  const frac = duration > 0 && preview != null ? preview / duration : 0
  const thumbW = mobile ? PREVIEW_W.phone : PREVIEW_W.desktop
  const previewSheet =
    trickplay && sheetUrl && preview != null ? sheetUrl(frameFor(preview, trickplay).sheet) : null
  const showThumb = previewSheet != null && sheetState(previewSheet) === "ok"

  return (
    <div className="flex items-center gap-3 text-xs tabular-nums">
      <span>{fmtTime(shown)}</span>
      <div
        ref={wrapRef}
        data-seek
        className="relative flex flex-1 items-center py-2"
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && !draggingRef.current) setPreview(timeAtX(e.clientX))
        }}
        onPointerLeave={() => {
          if (!draggingRef.current) setPreview(null)
        }}
      >
        <AnimatePresence>
          {preview != null && duration > 0 ? (
            <motion.div
              key="scrub-preview"
              variants={bubbleVariants}
              initial="hidden"
              animate={dragging ? "held" : "show"}
              exit="exit"
              className="pointer-events-none absolute bottom-full z-10 mb-2 flex flex-col items-center gap-1"
              style={{
                left: `clamp(${thumbW / 2}px, ${frac * 100}%, calc(100% - ${thumbW / 2}px))`,
                transformOrigin: "bottom center",
              }}
            >
              <AnimatePresence initial={false}>
                {trickplay && previewSheet && showThumb ? (
                  <motion.div
                    key="thumb"
                    variants={thumbVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="rounded-md p-0.5 shadow-xl ring-1 ring-white/30"
                  >
                    <ScrubThumb
                      t={preview}
                      trickplay={trickplay}
                      sheetUrl={previewSheet}
                      width={thumbW}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <span className="rounded bg-black/80 px-1.5 py-0.5 font-medium text-white text-xs ring-1 ring-white/20">
                {fmtTime(preview)}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={shown}
          onPointerDown={() => {
            draggingRef.current = true
            pendingRef.current = null
            setDragging(true)
            onScrubbing(true)
          }}
          onChange={(e) => {
            const t = Number(e.target.value)
            if (draggingRef.current) {
              pendingRef.current = t
              setPreview(t)
            } else {
              onSeek(t) // keyboard nudge on the focused slider
            }
          }}
          aria-label="Seek"
          className="h-1 w-full cursor-pointer touch-none accent-red-600"
        />
      </div>
      <span>{fmtTime(duration)}</span>
    </div>
  )
}
