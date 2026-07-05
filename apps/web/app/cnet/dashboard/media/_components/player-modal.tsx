"use client"

import Hls from "hls.js"
import {
  Check,
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
  getItemTracks,
  mediaUrl,
  type Playable,
  reportProgress,
  reportStopped,
  type SubtitleTrack,
  setWatched,
  TICKS_PER_SECOND,
} from "@/lib/media-api"

const SKIP = 5 // seconds for the back/forward skip buttons
const NEXT_CARD_AT = 25 // show the "Up next" card this many seconds before the end

function fmtTime(input: number): string {
  const s = Number.isFinite(input) && input > 0 ? input : 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
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
 * audio/subtitle menus, and — for a series queue — a "Next episode" button
 * plus an "Up next" card that auto-advances when an episode ends.
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
  const [index, setIndex] = useState(startIndex)
  const item = queue[index]
  const next = index < queue.length - 1 ? queue[index + 1] : null

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Where to seek once the (re)loaded stream is ready, and whether to resume
  // playing — set on item change (resume point) and on audio-track switches
  // (current position), so swapping audio is seamless.
  const seekTargetRef = useRef(0)
  const wasPlayingRef = useRef(true)

  // Server-provided audio tracks. `audioIndex` is the selected Jellyfin stream
  // index; `undefined` = still loading (gates stream setup so we load the right
  // track once instead of flashing the file's default first).
  const [audioOpts, setAudioOpts] = useState<AudioTrack[]>([])
  const [audioIndex, setAudioIndex] = useState<number | null | undefined>(undefined)
  // Text subtitle tracks from the API (each a full Stream.vtt, not HLS-segmented).
  const [subTracks, setSubTracks] = useState<SubtitleTrack[]>([])
  // Selected subtitle = Jellyfin stream index, or -1 for off.
  const [curSub, setCurSub] = useState(-1)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uiVisible, setUiVisible] = useState(true)

  const goNext = useCallback(() => {
    setIndex((i) => (i < queue.length - 1 ? i + 1 : i))
  }, [queue.length])

  // On item change, fetch its audio tracks and pick the default (English →
  // Japanese → the file's own default). `audioIndex` starts `undefined` here,
  // which gates the stream-setup effect so it loads the right track in one shot
  // instead of flashing the file's (often Spanish) default first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only on item change
  useEffect(() => {
    let cancelled = false
    setAudioIndex(undefined)
    setAudioOpts([])
    setSubTracks([])
    setSettingsOpen(false)
    setCurSub(-1)
    wasPlayingRef.current = true
    seekTargetRef.current =
      item.resumePositionTicks > 0 ? item.resumePositionTicks / TICKS_PER_SECOND : 0
    getItemTracks(item.id)
      .then((t) => {
        if (cancelled) return
        setAudioOpts(t.audio)
        setSubTracks(t.subtitles)
        setAudioIndex(t.preferredAudioIndex)
      })
      .catch(() => {
        if (!cancelled) setAudioIndex(null) // fall back to the stream's default audio
      })
    return () => {
      cancelled = true
    }
  }, [index])

  // (Re)load + wire up the video when the item OR the chosen audio track changes.
  // Switching audio re-requests the HLS with a different AudioStreamIndex because
  // Jellyfin muxes a single audio stream into the segments; `seekTargetRef` keeps
  // playback position across the swap.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only on item/audio change
  useEffect(() => {
    const video = videoRef.current
    if (!video || audioIndex === undefined) return
    const src =
      mediaUrl(item.hlsUrl) + (audioIndex != null ? `&audioStreamIndex=${audioIndex}` : "")
    const ticks = () => Math.round(video.currentTime * TICKS_PER_SECOND)
    const startAt = seekTargetRef.current
    const resume = wasPlayingRef.current
    let hls: Hls | null = null

    setCurrent(0)
    setDuration(0)

    if (Hls.isSupported()) {
      // renderTextTracksNatively:false — subtitles are handled by our own <track>
      // elements (full Stream.vtt). Jellyfin's HLS-segmented subtitles only fill
      // the OP window for heavily-typeset anime ASS, so we don't let hls use them.
      hls = new Hls({ enableWorker: true, renderTextTracksNatively: false })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applySubtitleMode()
        if (startAt > 0) video.currentTime = startAt
        if (resume) void video.play().catch(() => {})
      })
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively.
      video.src = src
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (startAt > 0) video.currentTime = startAt
          if (resume) void video.play().catch(() => {})
        },
        { once: true }
      )
    }

    const onTime = () => setCurrent(video.currentTime)
    const onMeta = () => {
      setDuration(video.duration || 0)
      applySubtitleMode()
    }
    const onPlayEv = () => {
      setIsPlaying(true)
      void reportProgress(item.id, ticks(), false).catch(() => {})
    }
    const onPauseEv = () => {
      setIsPlaying(false)
      void reportProgress(item.id, ticks(), true).catch(() => {})
    }
    const onVol = () => {
      setMuted(video.muted)
      setVolume(video.volume)
    }
    const onEnded = () => {
      void setWatched(item.id, true).catch(() => {})
      if (index < queue.length - 1) setIndex((i) => i + 1)
      else onClose()
    }

    video.addEventListener("timeupdate", onTime)
    video.addEventListener("durationchange", onMeta)
    video.addEventListener("loadedmetadata", onMeta)
    // A reload can reset text-track modes slightly after metadata; re-apply once
    // frame data is ready too, so subtitles survive an audio switch.
    video.addEventListener("loadeddata", applySubtitleMode)
    video.addEventListener("play", onPlayEv)
    video.addEventListener("pause", onPauseEv)
    video.addEventListener("volumechange", onVol)
    video.addEventListener("ended", onEnded)

    const heartbeat = setInterval(() => {
      if (!video.paused) void reportProgress(item.id, ticks(), false).catch(() => {})
    }, 15_000)

    return () => {
      clearInterval(heartbeat)
      void reportStopped(item.id, ticks()).catch(() => {})
      video.removeEventListener("timeupdate", onTime)
      video.removeEventListener("durationchange", onMeta)
      video.removeEventListener("loadedmetadata", onMeta)
      video.removeEventListener("loadeddata", applySubtitleMode)
      video.removeEventListener("play", onPlayEv)
      video.removeEventListener("pause", onPauseEv)
      video.removeEventListener("volumechange", onVol)
      video.removeEventListener("ended", onEnded)
      hls?.destroy()
      hlsRef.current = null
    }
    // Re-init on item change or audio-track switch; other deps are stable refs/setters.
  }, [index, audioIndex])

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  // Auto-hiding controls shouldn't leave the settings popover floating.
  useEffect(() => {
    if (!uiVisible) setSettingsOpen(false)
  }, [uiVisible])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }, [])

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || t, t))
    setCurrent(v.currentTime)
  }, [])

  const skip = useCallback(
    (d: number) => {
      const v = videoRef.current
      if (v) seekTo(v.currentTime + d)
    },
    [seekTo]
  )

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (v) v.muted = !v.muted
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void containerRef.current?.requestFullscreen().catch(() => {})
  }, [])

  const revealUi = useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setUiVisible(false)
    }, 3000)
  }, [])

  useEffect(() => {
    revealUi()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [revealUi])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          if (!document.fullscreenElement) onClose()
          break
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowLeft":
          skip(-SKIP)
          break
        case "ArrowRight":
          skip(SKIP)
          break
        case "f":
          toggleFullscreen()
          break
        case "m":
          toggleMute()
          break
        case "n":
          goNext()
          break
        default:
          return
      }
      revealUi()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, togglePlay, skip, toggleFullscreen, toggleMute, goNext, revealUi])

  // Switching audio re-requests the stream at a new AudioStreamIndex; remember
  // the current position + play state so the setup effect resumes seamlessly.
  const selectAudio = (streamIndex: number) => {
    if (streamIndex === audioIndex) return
    const v = videoRef.current
    if (v) {
      seekTargetRef.current = v.currentTime
      wasPlayingRef.current = !v.paused
    }
    setAudioIndex(streamIndex)
  }
  // Selecting a subtitle just records the chosen stream index (-1 = off); the
  // effect below toggles the matching native <track>'s mode.
  const selectSub = (streamIndex: number) => setCurSub(streamIndex)

  // Full-file WebVTT URL for a subtitle stream, signed via the item's HLS URL and
  // routed through the proxy's .vtt sanitizer. One file with every cue — Jellyfin's
  // 30s HLS subtitle windows drop all cues after the OP for typeset anime ASS.
  const subtitleUrl = (streamIndex: number) =>
    `${mediaUrl(item.hlsUrl)}&path=${encodeURIComponent(`${item.id}/Subtitles/${streamIndex}/0/Stream.vtt`)}`

  // Refs mirror the current selection + track list so the stream-reload handlers
  // (closures below) can re-apply subtitle modes without capturing stale values.
  const curSubRef = useRef(-1)
  const subTracksRef = useRef<SubtitleTrack[]>([])
  useEffect(() => {
    curSubRef.current = curSub
  }, [curSub])
  useEffect(() => {
    subTracksRef.current = subTracks
  }, [subTracks])

  // Toggle the chosen native <track> to "showing" (others "disabled"). Called on
  // selection change AND after every (re)load: switching audio rebuilds hls and
  // reattaches the media, which resets text-track modes, so we must re-apply then
  // (else subs vanish on an audio switch and don't come back on switching again).
  const applySubtitleMode = useCallback(() => {
    const tracks = videoRef.current?.textTracks
    if (!tracks) return
    const subs = subTracksRef.current
    for (let i = 0; i < subs.length && i < tracks.length; i++) {
      tracks[i].mode = subs[i].index === curSubRef.current ? "showing" : "disabled"
    }
  }, [])

  // Re-apply when the track list loads or the selection changes (the no-reload case;
  // the reload case is handled in the stream effect's load handlers).
  // biome-ignore lint/correctness/useExhaustiveDependencies: subTracks/curSub drive the re-apply (applySubtitleMode reads them via refs)
  useEffect(() => {
    applySubtitleMode()
  }, [subTracks, curSub, applySubtitleMode])

  const remaining = duration - current
  const showUpNext = duration > 0 && remaining <= NEXT_CARD_AT && remaining > 0

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: player chrome reveals controls on mouse move; not a control itself
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex select-none flex-col bg-black"
      onMouseMove={revealUi}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: subtitles are selectable, user-controlled tracks */}
      <video
        ref={videoRef}
        autoPlay
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full bg-black"
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

      {/* Controls overlay */}
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/70 via-transparent to-black/80 transition-opacity duration-300 ${
          uiVisible ? "opacity-100" : "opacity-0"
        }`}
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
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span>{fmtTime(current)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={(e) => seekTo(Number(e.target.value))}
              aria-label="Seek"
              className="h-1 flex-1 cursor-pointer accent-red-600"
            />
            <span>{fmtTime(duration)}</span>
          </div>

          <div className="flex items-center gap-4">
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
                  const v = videoRef.current
                  if (v) {
                    v.volume = Number(e.target.value)
                    v.muted = Number(e.target.value) === 0
                  }
                }}
                aria-label="Volume"
                className="h-1 w-20 cursor-pointer accent-white"
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              {audioOpts.length > 1 || subTracks.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((o) => !o)}
                    aria-label="Audio and subtitles"
                    aria-expanded={settingsOpen}
                    className={`rounded p-1 hover:text-white/80 ${settingsOpen ? "text-white" : ""}`}
                  >
                    <Settings className="h-6 w-6" />
                  </button>
                  {settingsOpen ? (
                    <div className="absolute right-0 bottom-10 flex w-[26rem] max-w-[calc(100vw-1.5rem)] gap-2 rounded-md bg-neutral-900/95 p-3 text-sm shadow-xl ring-1 ring-white/15">
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
                    </div>
                  ) : null}
                </div>
              ) : null}
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

      {/* Up next card (Netflix style) */}
      {next && showUpNext ? (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-6 bottom-28 z-10 flex w-72 items-center gap-3 rounded-md bg-neutral-900/95 p-3 text-left text-white shadow-xl ring-1 ring-white/20 hover:bg-neutral-800"
        >
          <SkipForward className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block text-white/60 text-xs">
              Up next · in {Math.ceil(remaining)}s
            </span>
            <span className="block truncate font-medium text-sm">{displayTitle(next)}</span>
          </span>
        </button>
      ) : null}
    </div>
  )
}
