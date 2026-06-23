"use client"

import Hls from "hls.js"
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  mediaUrl,
  type Playable,
  reportProgress,
  reportStopped,
  setWatched,
  TICKS_PER_SECOND,
} from "@/lib/media-api"

type Track = { id: number; label: string }

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

  const [audioTracks, setAudioTracks] = useState<Track[]>([])
  const [subTracks, setSubTracks] = useState<Track[]>([])
  const [curAudio, setCurAudio] = useState(0)
  const [curSub, setCurSub] = useState(-1)

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

  // Load + wire up the video whenever the current item (index) changes.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const src = mediaUrl(item.hlsUrl)
    const ticks = () => Math.round(video.currentTime * TICKS_PER_SECOND)
    const startAt = item.resumePositionTicks > 0 ? item.resumePositionTicks / TICKS_PER_SECOND : 0
    let hls: Hls | null = null

    setAudioTracks([])
    setSubTracks([])
    setCurAudio(0)
    setCurSub(-1)
    setCurrent(0)
    setDuration(0)

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setAudioTracks(
          hls?.audioTracks.map((t, i) => ({
            id: i,
            label: t.name || t.lang || `Audio ${i + 1}`,
          })) ?? []
        )
        setSubTracks(
          hls?.subtitleTracks.map((t, i) => ({
            id: i,
            label: t.name || t.lang || `Track ${i + 1}`,
          })) ?? []
        )
        if (startAt > 0) video.currentTime = startAt
        void video.play().catch(() => {})
      })
      // Track lists can settle after MANIFEST_PARSED; keep the menus in sync so
      // embedded subtitle/audio tracks always surface.
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () =>
        setSubTracks(
          hls?.subtitleTracks.map((t, i) => ({
            id: i,
            label: t.name || t.lang || `Track ${i + 1}`,
          })) ?? []
        )
      )
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () =>
        setAudioTracks(
          hls?.audioTracks.map((t, i) => ({
            id: i,
            label: t.name || t.lang || `Audio ${i + 1}`,
          })) ?? []
        )
      )
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively.
      video.src = src
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (startAt > 0) video.currentTime = startAt
          void video.play().catch(() => {})
        },
        { once: true }
      )
    }

    const onTime = () => setCurrent(video.currentTime)
    const onMeta = () => setDuration(video.duration || 0)
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
      video.removeEventListener("play", onPlayEv)
      video.removeEventListener("pause", onPauseEv)
      video.removeEventListener("volumechange", onVol)
      video.removeEventListener("ended", onEnded)
      hls?.destroy()
      hlsRef.current = null
    }
    // Re-init only when the playing item changes; other deps are stable refs/setters.
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only on item change
  }, [index])

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

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

  const selectAudio = (id: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = id
      setCurAudio(id)
    }
  }
  const selectSub = (id: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = id
      hlsRef.current.subtitleDisplay = id >= 0
      setCurSub(id)
    }
  }

  const remaining = duration - current
  const showUpNext = duration > 0 && remaining <= NEXT_CARD_AT && remaining > 0

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex select-none flex-col bg-black"
      onMouseMove={revealUi}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: subtitles are selectable HLS tracks */}
      <video
        ref={videoRef}
        autoPlay
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full bg-black"
      />

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
              {audioTracks.length > 1 ? (
                <label className="flex items-center gap-1 text-xs">
                  Audio
                  <select
                    value={curAudio}
                    onChange={(e) => selectAudio(Number(e.target.value))}
                    className="rounded bg-black/60 px-1 py-0.5 text-white text-xs"
                  >
                    {audioTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {subTracks.length > 0 ? (
                <label className="flex items-center gap-1 text-xs">
                  Subtitles
                  <select
                    value={curSub}
                    onChange={(e) => selectSub(Number(e.target.value))}
                    className="rounded bg-black/60 px-1 py-0.5 text-white text-xs"
                  >
                    <option value={-1}>Off</option>
                    {subTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
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
            <span className="block text-white/60 text-xs">Up next · in {Math.ceil(remaining)}s</span>
            <span className="block truncate font-medium text-sm">{displayTitle(next)}</span>
          </span>
        </button>
      ) : null}
    </div>
  )
}
