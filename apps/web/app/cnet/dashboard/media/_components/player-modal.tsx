"use client"

import { AnimatePresence, motion } from "framer-motion"
import Hls from "hls.js"
import {
  Check,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type AudioTrack,
  type Episode,
  getItemTracks,
  mediaUrl,
  type Playable,
  reportProgress,
  reportStopped,
  type SubtitleTrack,
  setWatched,
  TICKS_PER_SECOND,
  type Trickplay,
} from "@/lib/media-api"
import { cn } from "@/lib/utils"
import { EpisodePanel } from "./episode-panel"
import { popoverVariants, sheetVariants } from "./motion"
import { useIsMobile } from "./use-is-mobile"

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

const fullscreenElement = () => {
  const doc = document as FullscreenDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

const SKIP = 5 // seconds for the back/forward skip buttons
const NEXT_CARD_AT = 25 // show the "Up next" card this many seconds before the end
// How many audio tracks to keep warm at once when the video is direct-copied (H.264
// 8-bit): each warm track is then a full muxed stream where only the audio transcodes,
// so extra tracks are cheap — capped so a file with a pathological number of audio
// streams doesn't spin up a dozen sessions. When the video itself must be transcoded
// (HEVC / 10-bit) every warm track is a full parallel x264 encode, so only the active
// track is warmed and switching falls back to a reload.
const MAX_PARALLEL_AUDIO = 6
// Key for the "no explicit audio stream" instance (file default) — real Jellyfin audio
// stream indices are ≥ 1, so -1 is a safe sentinel.
const AUDIO_DEFAULT = -1

function fmtTime(input: number): string {
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
function frameFor(t: number, trickplay: Trickplay) {
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
 * a bubble above the pointer with the thumbnail and time you would land on; while
 * dragging, the seek itself is deferred to release so a long drag doesn't start a
 * transcode at every pixel along the way.
 */
function SeekBar({
  current,
  duration,
  trickplay,
  sheetUrl,
  mobile,
  onSeek,
  onScrubbing,
}: {
  current: number
  duration: number
  trickplay: Trickplay | null
  sheetUrl: (sheet: number) => string
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
  const firstSheet = trickplay ? sheetUrl(0) : null
  useEffect(() => {
    if (firstSheet) sheetState(firstSheet)
  }, [firstSheet, sheetState])

  const shown = dragging && preview != null ? preview : current
  const frac = duration > 0 && preview != null ? preview / duration : 0
  const thumbW = mobile ? PREVIEW_W.phone : PREVIEW_W.desktop
  const previewSheet =
    trickplay && preview != null ? sheetUrl(frameFor(preview, trickplay).sheet) : null
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
        {preview != null && duration > 0 ? (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 flex -translate-x-1/2 flex-col items-center gap-1"
            style={{
              left: `clamp(${thumbW / 2}px, ${frac * 100}%, calc(100% - ${thumbW / 2}px))`,
            }}
          >
            {trickplay && previewSheet && showThumb ? (
              <div className="rounded-md p-0.5 shadow-xl ring-1 ring-white/30">
                <ScrubThumb
                  t={preview}
                  trickplay={trickplay}
                  sheetUrl={previewSheet}
                  width={thumbW}
                />
              </div>
            ) : null}
            <span className="rounded bg-black/80 px-1.5 py-0.5 font-medium text-white text-xs ring-1 ring-white/20">
              {fmtTime(preview)}
            </span>
          </div>
        ) : null}
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

function displayTitle(item: Playable): string {
  if (item.seasonNumber != null && item.episodeNumber != null) {
    return `${item.seriesName ? `${item.seriesName} · ` : ""}S${item.seasonNumber}:E${item.episodeNumber} ${item.title}`
  }
  return `${item.title}${item.year ? ` (${item.year})` : ""}`
}

/**
 * Full-screen, Netflix-style HLS player. Plays Jellyfin's transcoded stream
 * (video copied, audio→AAC so it's browser-playable) via hls.js with custom
 * controls: auto-hiding overlay, ±5s skip, scrubber, volume, fullscreen,
 * audio/subtitle menus, an in-player episode selector, and — for a series queue —
 * a "Next episode" button plus an "Up next" card that auto-advances at the end.
 *
 * Instant audio switching: rather than reload the stream (a new Jellyfin transcode
 * session) when you pick a different language, we keep one warm hls.js instance per
 * audio track, all playing in lockstep and muted except the active one. Switching just
 * hands audio from one <video> to another — no wait, exactly like switching subtitles.
 */
export function PlayerModal({
  queue,
  startIndex = 0,
  onClose,
}: {
  queue: Playable[]
  startIndex?: number
  onClose: () => void
}) {
  // The play queue lives in state so the in-player episode selector can swap it (e.g.
  // jumping to another season) while keeping auto-advance ("Up next") working.
  const [list, setList] = useState<Playable[]>(queue)
  const [index, setIndex] = useState(startIndex)
  const item = list[index] ?? list[0]
  const next = index < list.length - 1 ? list[index + 1] : null

  const containerRef = useRef<HTMLDivElement>(null)
  // One <video> + hls.js instance per warm audio track, keyed by audio stream index.
  const mediaRefs = useRef(new Map<number, HTMLVideoElement>())
  const hlsRefs = useRef(new Map<number, Hls>())
  const refSetters = useRef(new Map<number, (el: HTMLVideoElement | null) => void>())
  const activeAudioRef = useRef<number>(AUDIO_DEFAULT)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Where to seek once the (re)loaded stream is ready, and whether to resume playing —
  // set on item change (resume point) and on the rare reload-fallback audio switch.
  const seekTargetRef = useRef(0)
  const wasPlayingRef = useRef(true)
  // Last known playback position (seconds); used to report "stopped" on teardown, when
  // the active <video> has already been unmounted by the keyed remount.
  const lastPosRef = useRef(0)

  // Signed HLS URL for the current item, minted by the tracks fetch. Deliberately not
  // `item.hlsUrl`: that one is signed when the library list is fetched, and the list is
  // never refetched while a tab sits open (refetchOnWindowFocus is off), so a player
  // opened later would start on a signature that expires mid-episode.
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  // Bumped to force a full rebuild of the warm instances — the recovery path below.
  const [reloadNonce, setReloadNonce] = useState(0)
  const [recovering, setRecovering] = useState(false)
  const recoverAttempts = useRef(0)
  const rebuildTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rebuilding = useRef(false)
  // Consecutive fatal hls.js errors per warm instance, so we escalate rather than
  // retry the same recovery forever.
  const fatalCount = useRef(new Map<number, number>())
  const itemIdRef = useRef(item.id)

  // Server-provided audio tracks. `audioIndex` is the active (audible) Jellyfin stream
  // index; `undefined` = still loading (gates stream setup so we load the right track
  // once instead of flashing the file's default first). `null` = file default.
  const [audioOpts, setAudioOpts] = useState<AudioTrack[]>([])
  const [audioIndex, setAudioIndex] = useState<number | null | undefined>(undefined)
  // False when Jellyfin must transcode the video stream — then only one track is warmed.
  const [videoDirect, setVideoDirect] = useState(true)
  // Text subtitle tracks from the API (each a full Stream.vtt, not HLS-segmented).
  const [subTracks, setSubTracks] = useState<SubtitleTrack[]>([])
  // Selected subtitle = Jellyfin stream index, or -1 for off.
  const [curSub, setCurSub] = useState(-1)
  // Seconds into the item where the end credits start (chapter markers), or null.
  const [creditsStart, setCreditsStart] = useState<number | null>(null)
  // Intro/OP [start, end) seconds (from chapters) for the "Skip Intro" button.
  const [intro, setIntro] = useState<{ start: number; end: number } | null>(null)
  // Scrub-preview tile grid, when Jellyfin has generated one for this item.
  const [trickplay, setTrickplay] = useState<Trickplay | null>(null)
  // Playback speed. The media element resets playbackRate to 1 on every (re)load, so we
  // stash it in a ref and re-apply after each load (audio switch / episode).
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [episodesOpen, setEpisodesOpen] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const mutedRef = useRef(false)
  const volumeRef = useRef(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uiVisible, setUiVisible] = useState(true)
  const uiVisibleRef = useRef(true)
  uiVisibleRef.current = uiVisible
  // On touch, a tap on a hidden-controls picture only reveals the controls; the
  // click that follows must not also pause. Set at touchstart, consumed by the click.
  const tapWasReveal = useRef(false)
  // What pressed the picture last. A finger tap on visible controls dismisses them, the
  // way phone players do; a mouse click still toggles playback.
  const lastPointerType = useRef("mouse")
  const mobile = useIsMobile()

  // The set of audio streams to keep warm (all of them, capped), plus a stable signature
  // so the setup effect rebuilds only on item / track-set change — NOT on audio switch.
  const activeKey = audioIndex ?? AUDIO_DEFAULT
  const audioKeys: number[] =
    audioIndex === undefined
      ? []
      : audioOpts.length <= 1 || !videoDirect
        ? [activeKey]
        : (() => {
            const keys = audioOpts.map((a) => a.index).slice(0, MAX_PARALLEL_AUDIO)
            if (!keys.includes(activeKey)) keys.push(activeKey)
            return keys.sort((a, b) => a - b)
          })()
  const audioKeysSig = `${videoDirect ? "d" : "t"}:${audioKeys.join(",")}`

  const goNext = useCallback(() => {
    setIndex((i) => (i < list.length - 1 ? i + 1 : i))
  }, [list.length])

  const registerMedia = (ai: number) => {
    let fn = refSetters.current.get(ai)
    if (!fn) {
      fn = (el: HTMLVideoElement | null) => {
        if (el) mediaRefs.current.set(ai, el)
        else mediaRefs.current.delete(ai)
      }
      refSetters.current.set(ai, fn)
    }
    return fn
  }

  const getActive = useCallback(() => mediaRefs.current.get(activeAudioRef.current) ?? null, [])
  const ticksNow = useCallback(
    () => Math.round((getActive()?.currentTime ?? lastPosRef.current) * TICKS_PER_SECOND),
    [getActive]
  )

  const subTracksRef = useRef<SubtitleTrack[]>([])
  const curSubRef = useRef(-1)
  useEffect(() => {
    subTracksRef.current = subTracks
  }, [subTracks])
  useEffect(() => {
    curSubRef.current = curSub
  }, [curSub])
  useEffect(() => {
    activeAudioRef.current = audioIndex ?? AUDIO_DEFAULT
  }, [audioIndex])
  useEffect(() => {
    itemIdRef.current = item.id
  }, [item.id])

  // Apply the chosen subtitle across every warm <video>: "showing" on the active one,
  // "hidden" on the standbys (so their cues are pre-fetched and appear instantly on an
  // audio switch), "disabled" otherwise. Instances persist across audio switches, so a
  // switch never drops or re-downloads video — only audio hands over.
  const applySubtitleMode = useCallback(() => {
    const active = activeAudioRef.current
    const subs = subTracksRef.current
    mediaRefs.current.forEach((video, ai) => {
      const tracks = video.textTracks
      for (let i = 0; i < subs.length && i < tracks.length; i++) {
        tracks[i].mode =
          subs[i].index === curSubRef.current ? (ai === active ? "showing" : "hidden") : "disabled"
      }
    })
  }, [])

  // On item change, (re)fetch its tracks and pick the default audio (English → Japanese
  // → the file's own default). `audioIndex` starts `undefined`, which gates the setup
  // effect so it loads the right track in one shot instead of flashing the file default.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only on played item change
  useEffect(() => {
    let cancelled = false
    setAudioIndex(undefined)
    setAudioOpts([])
    setSubTracks([])
    setCreditsStart(null)
    setIntro(null)
    setTrickplay(null)
    setSettingsOpen(false)
    setCurSub(-1)
    setStreamUrl(null)
    setRecovering(false)
    recoverAttempts.current = 0
    fatalCount.current.clear()
    wasPlayingRef.current = true
    seekTargetRef.current =
      item.resumePositionTicks > 0 ? item.resumePositionTicks / TICKS_PER_SECOND : 0
    lastPosRef.current = seekTargetRef.current
    getItemTracks(item.id)
      .then((t) => {
        if (cancelled) return
        setStreamUrl(t.hlsUrl)
        setAudioOpts(t.audio)
        setVideoDirect(t.videoDirect)
        setSubTracks(t.subtitles)
        setCreditsStart(t.creditsStartSeconds)
        setTrickplay(t.trickplay)
        setIntro(
          t.introStartSeconds != null && t.introEndSeconds != null
            ? { start: t.introStartSeconds, end: t.introEndSeconds }
            : null
        )
        activeAudioRef.current = t.preferredAudioIndex ?? AUDIO_DEFAULT
        setAudioIndex(t.preferredAudioIndex)
      })
      .catch(() => {
        if (cancelled) return
        activeAudioRef.current = AUDIO_DEFAULT
        setStreamUrl(item.hlsUrl) // list-signed URL is all we have if tracks failed
        setAudioIndex(null) // fall back to the stream's default audio
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  // Full-file WebVTT URL for a subtitle stream, signed via the item's HLS URL and routed
  // through the proxy's .vtt sanitizer. One file with every cue — Jellyfin's 30s HLS
  // subtitle windows drop all cues after the OP for typeset anime ASS.
  const signed = streamUrl ?? item.hlsUrl
  const subtitleUrl = (streamIndex: number) =>
    `${mediaUrl(signed)}&path=${encodeURIComponent(`${item.id}/Subtitles/${streamIndex}/0/Stream.vtt`)}`
  const srcFor = (ai: number) =>
    mediaUrl(signed) + (ai !== AUDIO_DEFAULT ? `&audioStreamIndex=${ai}` : "")
  // Trickplay sheet `n`, through the same signed proxy (Jellyfin serves them under the
  // item's Videos/ path, so no extra route is needed).
  const sheetUrl = useCallback(
    (sheet: number) =>
      `${mediaUrl(signed)}&path=${encodeURIComponent(`Trickplay/${trickplay?.width ?? 0}/${sheet}.jpg`)}`,
    [signed, trickplay?.width]
  )

  /**
   * Tear the stream down and build it again from the current position, on a freshly
   * signed URL. This is the escape hatch from a *fatal* hls.js error: hls.js latches
   * its stream controller into an error state and never loads again on its own, so
   * without this the picture simply freezes for good — which is exactly how coming
   * back to a player that had been left alone used to fail (signature aged out, or
   * the socket/decoder went away while the tab was in the background).
   */
  const rebuild = useCallback(() => {
    if (rebuilding.current) return
    rebuilding.current = true
    setRecovering(true)
    const active = getActive()
    seekTargetRef.current = active?.currentTime ?? lastPosRef.current
    wasPlayingRef.current = active ? !active.paused : true
    const id = itemIdRef.current
    // Back off so a box that is genuinely down isn't hammered with transcode starts.
    const wait = Math.min(1000 * 2 ** recoverAttempts.current++, 15_000)
    rebuildTimer.current = setTimeout(() => {
      // Re-sign first: once `exp` has passed every segment 403s, and reloading the
      // same URL can only 403 again.
      getItemTracks(id)
        .then((t) => {
          if (itemIdRef.current !== id) return
          setStreamUrl(t.hlsUrl)
          setVideoDirect(t.videoDirect)
        })
        .catch(() => {}) // no fresh signature — a plain rebuild still clears a wedged decoder
        .finally(() => {
          if (itemIdRef.current === id) setReloadNonce((n) => n + 1)
          else rebuilding.current = false
        })
    }, wait)
  }, [getActive])

  // Build one warm hls.js instance per audio track and attach each to its own <video>.
  // Rebuilt only on item / track-set change — an audio switch reuses these instances.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setup keys on item + track set; other reads are refs
  useEffect(() => {
    rebuilding.current = false
    if (audioKeys.length === 0) return
    const startAt = seekTargetRef.current
    const resume = wasPlayingRef.current
    const active = activeAudioRef.current
    const itemId = item.id

    for (const ai of audioKeys) {
      const video = mediaRefs.current.get(ai)
      if (!video) continue
      const isActive = ai === active
      video.muted = isActive ? mutedRef.current : true
      video.volume = volumeRef.current
      const src = srcFor(ai)
      // Called once the stream is ready: seek to the resume point, then start playback.
      // The active track autoplays (on resume); a standby only plays if the active is
      // already playing — so a blocked autoplay or a pause never lets the muted standbys
      // drift ahead of what you're watching (which would desync an audio switch).
      const onReady = () => {
        if (startAt > 0) video.currentTime = startAt
        video.playbackRate = speedRef.current
        if (isActive) {
          applySubtitleMode()
          if (resume) void video.play().catch(() => {})
        } else {
          const a = getActive()
          if (a && !a.paused) {
            // Align to the active's live position (not the stale resume point) so a
            // late-ready standby doesn't sit permanently behind.
            try {
              video.currentTime = a.currentTime
            } catch {}
            void video.play().catch(() => {})
          }
        }
      }
      if (Hls.isSupported()) {
        // renderTextTracksNatively:false — subtitles are our own <track> elements (full
        // Stream.vtt). Standby tracks keep a short buffer so N warm streams stay light.
        const hls = new Hls({
          enableWorker: true,
          renderTextTracksNatively: false,
          maxBufferLength: isActive ? 30 : 12,
          backBufferLength: isActive ? 30 : 6,
        })
        hlsRefs.current.set(ai, hls)
        // Fatal errors are terminal unless we act on them — see `rebuild`. Escalate
        // in place first (cheap: no new transcode session on the box), then fall back
        // to a full re-signed reload.
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return
          const n = (fatalCount.current.get(ai) ?? 0) + 1
          fatalCount.current.set(ai, n)
          if (ai === activeAudioRef.current) setRecovering(true)
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && n <= 2) {
            // A backgrounded tab or a sleeping machine can lose the decoder; hls.js
            // can usually re-attach it without refetching anything.
            if (n === 2) hls.swapAudioCodec()
            hls.recoverMediaError()
            return
          }
          const code = data.response?.code
          // 401/403 means the signature aged out, so retrying this URL is pointless.
          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            n <= 2 &&
            code !== 401 &&
            code !== 403
          ) {
            hls.startLoad()
            return
          }
          rebuild()
        })
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, onReady)
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src // Safari plays HLS natively.
        video.addEventListener("loadedmetadata", onReady, { once: true })
        // No hls.js to escalate through here — a native error is already terminal.
        video.addEventListener("error", rebuild)
      }
    }

    return () => {
      void reportStopped(itemId, Math.round(lastPosRef.current * TICKS_PER_SECOND)).catch(() => {})
      for (const h of hlsRefs.current.values()) h.destroy()
      hlsRefs.current.clear()
      // The <video> elements outlive a rebuild (same React key), so the native-HLS
      // error listener has to come off or it stacks up one per rebuild.
      mediaRefs.current.forEach((v) => {
        v.removeEventListener("error", rebuild)
      })
    }
  }, [item.id, audioKeysSig, reloadNonce])

  // Bind playback listeners to whichever <video> is currently active. Re-runs on an audio
  // switch (cheap add/removeEventListener) but never touches the hls instances.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebinds to the active element on item/audio change
  useEffect(() => {
    const video = getActive()
    if (!video) return
    const playOthers = () => {
      mediaRefs.current.forEach((v) => {
        if (v === video) return
        // Re-align a standby that fell behind (e.g. started late) before resuming it.
        if (Math.abs(v.currentTime - video.currentTime) > 0.5) {
          try {
            v.currentTime = video.currentTime
          } catch {}
        }
        void v.play().catch(() => {})
      })
    }
    const pauseOthers = () => {
      mediaRefs.current.forEach((v) => {
        if (v !== video) v.pause()
      })
    }

    const onTime = () => {
      lastPosRef.current = video.currentTime
      setCurrent(video.currentTime)
    }
    const onMeta = () => {
      setDuration(video.duration || 0)
      applySubtitleMode()
      video.playbackRate = speedRef.current
    }
    const onPlayEv = () => {
      setIsPlaying(true)
      playOthers() // keep standby audio tracks in lockstep so a switch is seamless
      void reportProgress(item.id, ticksNow(), false).catch(() => {})
    }
    const onPauseEv = () => {
      setIsPlaying(false)
      pauseOthers()
      void reportProgress(item.id, ticksNow(), true).catch(() => {})
    }
    const onVol = () => {
      const a = getActive()
      if (!a) return
      setMuted(a.muted)
      setVolume(a.volume)
      mutedRef.current = a.muted
      volumeRef.current = a.volume
    }
    // Frames are flowing again — clear the recovery state so the next hiccup gets a
    // full escalation ladder rather than resuming a half-spent one.
    const onPlaying = () => {
      recoverAttempts.current = 0
      fatalCount.current.clear()
      setRecovering(false)
    }
    const onEnded = () => {
      void setWatched(item.id, true).catch(() => {})
      if (index < list.length - 1) setIndex((i) => i + 1)
      else onClose()
    }

    video.addEventListener("timeupdate", onTime)
    video.addEventListener("durationchange", onMeta)
    video.addEventListener("loadedmetadata", onMeta)
    video.addEventListener("loadeddata", applySubtitleMode)
    video.addEventListener("play", onPlayEv)
    video.addEventListener("pause", onPauseEv)
    video.addEventListener("volumechange", onVol)
    video.addEventListener("playing", onPlaying)
    video.addEventListener("ended", onEnded)
    applySubtitleMode()

    const heartbeat = setInterval(() => {
      if (!video.paused) void reportProgress(item.id, ticksNow(), false).catch(() => {})
    }, 15_000)

    return () => {
      clearInterval(heartbeat)
      video.removeEventListener("timeupdate", onTime)
      video.removeEventListener("durationchange", onMeta)
      video.removeEventListener("loadedmetadata", onMeta)
      video.removeEventListener("loadeddata", applySubtitleMode)
      video.removeEventListener("play", onPlayEv)
      video.removeEventListener("pause", onPauseEv)
      video.removeEventListener("volumechange", onVol)
      video.removeEventListener("playing", onPlaying)
      video.removeEventListener("ended", onEnded)
    }
  }, [
    item.id,
    audioIndex,
    audioKeysSig,
    index,
    list.length,
    getActive,
    ticksNow,
    applySubtitleMode,
    onClose,
  ])

  useEffect(
    () => () => {
      if (rebuildTimer.current) clearTimeout(rebuildTimer.current)
    },
    []
  )

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(fullscreenElement()))
    document.addEventListener("fullscreenchange", onFs)
    document.addEventListener("webkitfullscreenchange", onFs)
    return () => {
      document.removeEventListener("fullscreenchange", onFs)
      document.removeEventListener("webkitfullscreenchange", onFs)
    }
  }, [])

  // Auto-hiding controls shouldn't leave the settings popover floating.
  useEffect(() => {
    if (!uiVisible) setSettingsOpen(false)
  }, [uiVisible])

  // Clicking anywhere outside an open settings popover or episode panel dismisses it.
  // Menu regions (and the buttons that toggle them) carry `data-player-menu`; the season
  // picker's Radix content is portalled to <body>, so it is recognised by its popper
  // wrapper, and an open Radix menu gets to dismiss itself first. The dismissing press
  // is swallowed so it doesn't also reach the <video> and toggle playback.
  const swallowClick = useRef(false)
  useEffect(() => {
    if (!settingsOpen && !episodesOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target || target.closest("[data-player-menu], [data-radix-popper-content-wrapper]"))
        return
      if (document.querySelector("[data-radix-menu-content][data-state=open]")) return
      setSettingsOpen(false)
      setEpisodesOpen(false)
      swallowClick.current = true
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [settingsOpen, episodesOpen])
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      e.stopPropagation()
      e.preventDefault()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  const togglePlay = useCallback(() => {
    const active = getActive()
    if (!active) return
    // Decide once up front: playing the active element flips its own `.paused` mid-loop.
    const play = active.paused
    mediaRefs.current.forEach((v) => {
      if (play) void v.play().catch(() => {})
      else v.pause()
    })
  }, [getActive])

  // Seek every warm instance together so they stay aligned for an instant audio switch.
  const seekTo = useCallback(
    (t: number) => {
      const active = getActive()
      if (!active) return
      const clamped = Math.max(0, Math.min(active.duration || t, t))
      mediaRefs.current.forEach((v) => {
        try {
          v.currentTime = clamped
        } catch {}
      })
      lastPosRef.current = clamped
      setCurrent(clamped)
    },
    [getActive]
  )

  const skip = useCallback(
    (d: number) => {
      const active = getActive()
      if (active) seekTo(active.currentTime + d)
    },
    [getActive, seekTo]
  )

  const toggleMute = useCallback(() => {
    const active = getActive()
    if (active) active.muted = !active.muted
  }, [getActive])

  const toggleFullscreen = useCallback(() => {
    const doc = document as FullscreenDocument
    const container = containerRef.current as FullscreenElement | null
    const video = getActive() as FullscreenVideo | null

    if (fullscreenElement()) {
      if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {})
      else doc.webkitExitFullscreen?.()
      return
    }
    if (video?.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.()
      return
    }

    // iPhone Safari has no element fullscreen: only the <video> itself can go
    // fullscreen, in the native player. Everything else takes the whole container
    // so our controls stay on screen.
    const enterNativeVideoFullscreen = () => {
      if (!video?.webkitEnterFullscreen) return
      video.addEventListener("webkitendfullscreen", () => setIsFullscreen(false), { once: true })
      video.webkitEnterFullscreen()
      setIsFullscreen(true)
    }
    if (container?.requestFullscreen) {
      container.requestFullscreen().catch(enterNativeVideoFullscreen)
    } else if (container?.webkitRequestFullscreen) {
      container.webkitRequestFullscreen()
    } else {
      enterNativeVideoFullscreen()
    }
  }, [getActive])

  // Keep the controls up while a menu is open or a finger is on the scrubber: on a
  // phone nothing moves the mouse while you read the settings sheet or hold a drag,
  // and hiding would close it under you.
  const menuOpenRef = useRef(false)
  menuOpenRef.current = settingsOpen || episodesOpen
  const scrubbingRef = useRef(false)

  const revealUi = useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!getActive()?.paused && !menuOpenRef.current && !scrubbingRef.current) setUiVisible(false)
    }, 3000)
  }, [getActive])

  const hideUi = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setUiVisible(false)
  }, [])

  const onScrubbing = useCallback(
    (active: boolean) => {
      scrubbingRef.current = active
      // Letting go re-arms the hide timer, which may have fired (and done nothing) mid-drag.
      if (!active) revealUi()
    },
    [revealUi]
  )

  // A press on the picture — or on empty overlay space beside the buttons, which is
  // still "the picture" to a thumb. With the controls hidden a tap only reveals them
  // (handled at touchstart). With them up, a tap puts them away, the way any phone
  // player does, and pause lives on the button; a mouse click keeps toggling playback.
  const onPictureTap = useCallback(() => {
    if (tapWasReveal.current) {
      tapWasReveal.current = false
      return
    }
    if (lastPointerType.current === "touch") hideUi()
    else togglePlay()
  }, [hideUi, togglePlay])

  // Closing a menu re-arms the hide timer, which may have fired (and done nothing)
  // while the menu was open.
  useEffect(() => {
    if (!settingsOpen && !episodesOpen) revealUi()
  }, [settingsOpen, episodesOpen, revealUi])

  useEffect(() => {
    revealUi()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [revealUi])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A popover inside the panel (the season picker) already consumed this key.
      if (e.defaultPrevented) return
      switch (e.key) {
        case "Escape":
          if (episodesOpen) setEpisodesOpen(false)
          else if (!fullscreenElement()) onClose()
          break
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        // Seek silently. Flashing the whole overlay up on every ±5s nudge covers
        // the picture you are scrubbing through, so these skip the reveal below.
        case "ArrowLeft":
          skip(-SKIP)
          return
        case "ArrowRight":
          skip(SKIP)
          return
        case "f":
          toggleFullscreen()
          break
        case "m":
          toggleMute()
          break
        case "n":
          goNext()
          break
        case "e":
          if (item.seriesId) setEpisodesOpen((o) => !o)
          break
        default:
          return
      }
      revealUi()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    onClose,
    togglePlay,
    skip,
    toggleFullscreen,
    toggleMute,
    goNext,
    revealUi,
    episodesOpen,
    item.seriesId,
  ])

  // Instant audio switch: hand audio from the current <video> to the chosen warm one —
  // sync position (correct any drift), copy volume/mute, then swap. No reload.
  const selectAudio = (ai: number) => {
    if (ai === activeKey) return
    const prev = mediaRefs.current.get(activeKey) ?? getActive()
    const target = mediaRefs.current.get(ai)
    activeAudioRef.current = ai
    if (!target) {
      // Not warm (a file with more audio tracks than we preload) — fall back to a reload.
      if (prev) {
        seekTargetRef.current = prev.currentTime
        wasPlayingRef.current = !prev.paused
      }
      setAudioIndex(ai)
      return
    }
    if (prev && prev !== target) {
      if (Math.abs(target.currentTime - prev.currentTime) > 0.3) {
        try {
          target.currentTime = prev.currentTime
        } catch {}
      }
      target.playbackRate = prev.playbackRate
      target.volume = prev.volume
      target.muted = prev.muted
      prev.muted = true
      if (!prev.paused) void target.play().catch(() => {})
    }
    setAudioIndex(ai)
  }
  // Selecting a subtitle just records the chosen stream index (-1 = off); applySubtitleMode
  // toggles the matching native <track>'s mode across the warm instances.
  const selectSub = (streamIndex: number) => setCurSub(streamIndex)

  const selectSpeed = (rate: number) => {
    speedRef.current = rate
    mediaRefs.current.forEach((v) => {
      v.playbackRate = rate
    })
    setSpeed(rate)
  }

  const skipIntro = () => {
    if (intro) seekTo(intro.end)
  }

  // Selecting an episode re-queues the whole season it belongs to (so auto-advance keeps
  // working) and jumps to it. Picking the one already playing just closes the panel.
  const selectEpisode = (episodes: Episode[], i: number) => {
    setEpisodesOpen(false)
    if (i < 0 || episodes[i]?.id === item.id) return
    wasPlayingRef.current = true
    setList(episodes)
    setIndex(i)
  }

  // Re-apply subtitle mode on the no-reload paths (track list load / selection change).
  // biome-ignore lint/correctness/useExhaustiveDependencies: subTracks/curSub drive the re-apply (read via refs)
  useEffect(() => {
    applySubtitleMode()
  }, [subTracks, curSub, audioIndex, applySubtitleMode])

  const remaining = duration - current
  // Show the "Up next" card once the end credits start (chapter marker), else fall back
  // to a fixed window before the end for items without a credits chapter.
  const showSkipIntro = intro != null && current >= intro.start && current < intro.end
  const inCredits = creditsStart != null && current >= creditsStart
  const nearEnd = duration > 0 && remaining <= NEXT_CARD_AT && remaining > 0
  const showUpNext = (inCredits || nearEnd) && (duration === 0 || remaining > 0)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: player chrome reveals controls on mouse move; not a control itself
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex select-none flex-col bg-black [-webkit-tap-highlight-color:transparent]"
      onMouseMove={revealUi}
      onTouchStart={() => {
        tapWasReveal.current = !uiVisibleRef.current
        revealUi()
      }}
    >
      {audioKeys.map((ai) => {
        const isActive = ai === activeKey
        return (
          // biome-ignore lint/a11y/useMediaCaption: subtitles are selectable, user-controlled tracks
          <video
            key={`${item.id}-${ai}`}
            ref={registerMedia(ai)}
            playsInline
            onPointerDown={(e) => {
              lastPointerType.current = e.pointerType
            }}
            onClick={onPictureTap}
            className={`absolute inset-0 h-full w-full bg-black transition-opacity duration-200 ${
              isActive ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {subTracks.map((s) => (
              <track
                key={s.index}
                kind="subtitles"
                label={s.label}
                srcLang={s.language ?? "und"}
                src={subtitleUrl(s.index)}
              />
            ))}
          </video>
        )
      })}

      {/* Recovering from a fatal stream error — never let the picture freeze silently. */}
      {recovering ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="rounded-md bg-black/70 px-4 py-2 font-medium text-sm text-white ring-1 ring-white/20">
            Reconnecting…
          </span>
        </div>
      ) : null}

      {/* Controls overlay. Its rows span the full width, so a press that lands on a row
          but not on a control bubbles up here and counts as a press on the picture. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: forwards presses on empty overlay space to the picture */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard playback control is the window keydown handler */}
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/70 via-transparent to-black/80 transition-[opacity,visibility] duration-300 ${
          uiVisible ? "visible opacity-100" : "invisible opacity-0"
        }`}
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType
        }}
        onClick={(e) => {
          const target = e.target as Element | null
          if (target?.closest("button, input, [data-player-menu], [data-seek]")) return
          onPictureTap()
        }}
      >
        {/* Top bar */}
        <div className="pointer-events-auto flex items-start justify-between gap-3 p-4 text-white">
          <span className="truncate font-medium text-lg drop-shadow">{displayTitle(item)}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="rounded-full p-1 hover:bg-white/20"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        {/* Center transport */}
        <div className="pointer-events-auto flex items-center justify-center gap-10 text-white">
          <button
            type="button"
            onClick={() => skip(-SKIP)}
            aria-label="Back 5 seconds"
            className="relative rounded-full p-2 hover:bg-white/15"
          >
            <RotateCcw className="h-12 w-12" />
            <span className="absolute inset-0 flex items-center justify-center font-bold text-[11px]">
              5
            </span>
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="rounded-full bg-white/10 p-4 hover:bg-white/20"
          >
            {isPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12" />}
          </button>
          <button
            type="button"
            onClick={() => skip(SKIP)}
            aria-label="Forward 5 seconds"
            className="relative rounded-full p-2 hover:bg-white/15"
          >
            <RotateCw className="h-12 w-12" />
            <span className="absolute inset-0 flex items-center justify-center font-bold text-[11px]">
              5
            </span>
          </button>
        </div>

        {/* Bottom bar */}
        <div className="pointer-events-auto flex flex-col gap-2 p-4 text-white">
          <SeekBar
            current={current}
            duration={duration}
            trickplay={trickplay}
            sheetUrl={sheetUrl}
            mobile={mobile}
            onSeek={seekTo}
            onScrubbing={onScrubbing}
          />

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="hover:text-white/80"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => skip(-SKIP)}
              aria-label="Back 5 seconds"
              className="relative hover:text-white/80"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="absolute inset-0 flex items-center justify-center font-bold text-[7px]">
                5
              </span>
            </button>
            <button
              type="button"
              onClick={() => skip(SKIP)}
              aria-label="Forward 5 seconds"
              className="relative hover:text-white/80"
            >
              <RotateCw className="h-6 w-6" />
              <span className="absolute inset-0 flex items-center justify-center font-bold text-[7px]">
                5
              </span>
            </button>
            {next ? (
              <button
                type="button"
                onClick={goNext}
                aria-label="Next episode"
                title="Next episode"
                className="hover:text-white/80"
              >
                <SkipForward className="h-6 w-6" />
              </button>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="hover:text-white/80"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = getActive()
                  if (v) {
                    v.volume = Number(e.target.value)
                    v.muted = Number(e.target.value) === 0
                  }
                }}
                aria-label="Volume"
                className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              {item.seriesId ? (
                <button
                  type="button"
                  data-player-menu
                  onClick={() => setEpisodesOpen((o) => !o)}
                  aria-label="Episodes"
                  aria-expanded={episodesOpen}
                  title="Episodes"
                  className={`rounded p-1 hover:text-white/80 ${episodesOpen ? "text-white" : ""}`}
                >
                  <ListVideo className="h-6 w-6" />
                </button>
              ) : null}
              <div className="relative" data-player-menu>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  aria-label="Audio, subtitles, and speed"
                  aria-expanded={settingsOpen}
                  className={`rounded p-1 hover:text-white/80 ${settingsOpen ? "text-white" : ""}`}
                >
                  <Settings className="h-6 w-6" />
                </button>
                <AnimatePresence>
                  {settingsOpen ? (
                    <motion.div
                      key="settings"
                      variants={mobile ? sheetVariants : popoverVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      style={{ transformOrigin: "bottom right" }}
                      className={cn(
                        "flex bg-neutral-900/95 text-sm shadow-xl ring-1 ring-white/15",
                        // Phones: a stacked bottom sheet; the anchored popover would hang
                        // off the left edge of the screen.
                        mobile
                          ? "fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
                          : "absolute right-0 bottom-10 w-[30rem] max-w-[calc(100vw-1.5rem)] gap-2 rounded-md p-3"
                      )}
                    >
                      {mobile ? (
                        <div
                          aria-hidden
                          className="-mt-2 mx-auto h-1 w-10 shrink-0 rounded-full bg-white/25"
                        />
                      ) : null}
                      {audioOpts.length > 1 ? (
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 px-2 font-semibold text-white/50 text-xs uppercase">
                            Audio
                          </p>
                          <div className="max-h-56 overflow-y-auto">
                            {audioOpts.map((t) => (
                              <button
                                key={t.index}
                                type="button"
                                onClick={() => selectAudio(t.index)}
                                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-white hover:bg-white/10"
                              >
                                <Check
                                  className={`mt-0.5 h-4 w-4 shrink-0 ${t.index === audioIndex ? "opacity-100" : "opacity-0"}`}
                                />
                                <span className="min-w-0 break-words">{t.label}</span>
                              </button>
                            ))}
                          </div>
                          {!videoDirect ? (
                            <p className="mt-1 px-2 text-white/40 text-xs">
                              Switching audio reloads on this file
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {subTracks.length > 0 ? (
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 px-2 font-semibold text-white/50 text-xs uppercase">
                            Subtitles
                          </p>
                          <div className="max-h-56 overflow-y-auto">
                            {[
                              { index: -1, label: "Off" },
                              ...subTracks.map((s) => ({ index: s.index, label: s.label })),
                            ].map((t) => (
                              <button
                                key={t.index}
                                type="button"
                                onClick={() => selectSub(t.index)}
                                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-white hover:bg-white/10"
                              >
                                <Check
                                  className={`mt-0.5 h-4 w-4 shrink-0 ${t.index === curSub ? "opacity-100" : "opacity-0"}`}
                                />
                                <span className="min-w-0 break-words">{t.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="w-full shrink-0 sm:w-20">
                        <p className="mb-1 px-2 font-semibold text-white/50 text-xs uppercase">
                          Speed
                        </p>
                        <div className="max-h-56 overflow-y-auto">
                          {[0.5, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => selectSpeed(r)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-white hover:bg-white/10"
                            >
                              <Check
                                className={`h-4 w-4 shrink-0 ${r === speed ? "opacity-100" : "opacity-0"}`}
                              />
                              <span>{r}×</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
                className="hover:text-white/80"
              >
                {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Skip Intro (Netflix style) — shown while playback is inside the OP chapter */}
      {showSkipIntro ? (
        <button
          type="button"
          onClick={skipIntro}
          className="absolute right-6 bottom-28 z-10 flex items-center gap-2 rounded-md bg-neutral-900/90 px-5 py-2.5 font-semibold text-sm text-white shadow-xl ring-1 ring-white/25 hover:bg-neutral-800"
        >
          <SkipForward className="h-4 w-4" />
          Skip Intro
        </button>
      ) : null}

      {/* Up next card (Netflix style) */}
      {next && showUpNext && !episodesOpen ? (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-6 bottom-28 z-10 flex w-72 items-center gap-3 rounded-md bg-neutral-900/95 p-3 text-left text-white shadow-xl ring-1 ring-white/20 hover:bg-neutral-800"
        >
          <SkipForward className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block text-white/60 text-xs">
              Up next{nearEnd ? ` · in ${Math.ceil(remaining)}s` : ""}
            </span>
            <span className="block truncate font-medium text-sm">{displayTitle(next)}</span>
          </span>
        </button>
      ) : null}

      {/* In-player episode selector (TV only) */}
      <AnimatePresence>
        {episodesOpen && item.seriesId ? (
          <EpisodePanel
            key="episodes"
            seriesId={item.seriesId}
            seriesName={item.seriesName}
            currentSeasonId={item.seasonId}
            currentItemId={item.id}
            onSelect={selectEpisode}
            onClose={() => setEpisodesOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
