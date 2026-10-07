"use client"

import {
  Captions,
  CaptionsOff,
  Check,
  Gauge,
  Maximize,
  Minimize,
  Music,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { srtToVtt } from "./subtitles"

/** A subtitle file to offer in the captions menu; fetched and converted to WebVTT lazily. */
export type SubtitleSource = { id: string; label: string; url: string }

type LoadedTrack = { id: string; label: string; vttUrl: string }

const SKIP_SECONDS = 10
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const HIDE_CONTROLS_AFTER_MS = 2500

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

/** Fetch each subtitle source once, convert SRT → VTT, and hand back blob URLs for <track>. */
function useSubtitleTracks(sources: SubtitleSource[]): {
  tracks: LoadedTrack[]
  addLocal: (file: File) => void
} {
  const [remote, setRemote] = useState<LoadedTrack[]>([])
  const [local, setLocal] = useState<LoadedTrack[]>([])

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    setRemote([])

    Promise.all(
      sources.map(async (source) => {
        try {
          const res = await fetch(source.url)
          if (!res.ok) return null
          const blob = new Blob([srtToVtt(await res.text())], { type: "text/vtt" })
          const vttUrl = URL.createObjectURL(blob)
          urls.push(vttUrl)
          return { id: source.id, label: source.label, vttUrl }
        } catch {
          return null
        }
      })
    ).then((loaded) => {
      if (!cancelled) setRemote(loaded.filter((t): t is LoadedTrack => t !== null))
    })

    return () => {
      cancelled = true
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [sources])

  useEffect(() => {
    return () => {
      for (const t of local) URL.revokeObjectURL(t.vttUrl)
    }
  }, [local])

  const addLocal = useCallback((file: File) => {
    file.text().then((text) => {
      const blob = new Blob([srtToVtt(text)], { type: "text/vtt" })
      const label = file.name.replace(/\.(srt|vtt)$/i, "")
      setLocal((prev) => [
        ...prev,
        { id: `local:${file.name}:${Date.now()}`, label, vttUrl: URL.createObjectURL(blob) },
      ])
    })
  }, [])

  const tracks = useMemo(() => [...remote, ...local], [remote, local])
  return { tracks, addLocal }
}

type MenuItem = { key: string; label: string; active: boolean; onSelect: () => void }

function PlayerMenu({
  title,
  items,
  onClose,
}: {
  title: string
  items: MenuItem[]
  onClose: () => void
}) {
  return (
    <div className="absolute right-0 bottom-full mb-2 min-w-40 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/95 py-1 text-sm text-white shadow-xl backdrop-blur">
      <div className="px-3 py-1.5 text-[11px] text-white/50 uppercase tracking-wide">{title}</div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left hover:bg-white/10"
        >
          <span className="truncate">{item.label}</span>
          {item.active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
        </button>
      ))}
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/15 ${
        active ? "text-sky-300" : "text-white"
      }`}
    >
      {children}
    </button>
  )
}

export function MediaPlayer({
  kind,
  src,
  title,
  subtitles,
}: {
  kind: "video" | "audio"
  src: string
  title: string
  subtitles: SubtitleSource[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { tracks, addLocal } = useSubtitleTracks(subtitles)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [activeTrack, setActiveTrack] = useState<string | null>(null)
  const [cueText, setCueText] = useState("")
  const [menu, setMenu] = useState<"speed" | "captions" | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const isVideo = kind === "video"
  // Read after mount so the server render matches the client's first paint.
  const [pipSupported, setPipSupported] = useState(false)
  useEffect(() => {
    setPipSupported(isVideo && "pictureInPictureEnabled" in document)
  }, [isVideo])

  // Metadata can land before the handlers attach (e.g. a cached source); sync from the element.
  useEffect(() => {
    const media = mediaRef.current
    if (!media || media.readyState < 1) return
    setDuration(media.duration)
    setVolume(media.volume)
    setMuted(media.muted)
  }, [])

  // Once a track is loaded, turn the first one on by default so sidecar subtitles just work.
  useEffect(() => {
    if (activeTrack === null && tracks.length > 0) setActiveTrack(tracks[0].id)
  }, [tracks, activeTrack])

  // Cues are rendered by us rather than the browser: the native overlay sits under the control
  // bar, and audio has no picture to draw on at all. Keep the track "hidden" so it still fires.
  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    const textTracks = media.textTracks
    let active: TextTrack | null = null
    for (let i = 0; i < textTracks.length; i++) {
      const isActive = tracks[i]?.id === activeTrack
      textTracks[i].mode = isActive ? "hidden" : "disabled"
      if (isActive) active = textTracks[i]
    }
    setCueText("")
    if (!active) return

    const track = active
    const onCue = () => {
      const cues = Array.from(track.activeCues ?? []) as VTTCue[]
      setCueText(cues.map((c) => c.text).join("\n"))
    }
    track.addEventListener("cuechange", onCue)
    return () => track.removeEventListener("cuechange", onCue)
  }, [tracks, activeTrack])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const togglePlay = useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    if (media.paused) media.play().catch(() => {})
    else media.pause()
  }, [])

  const seekBy = useCallback((delta: number) => {
    const media = mediaRef.current
    if (!media) return
    media.currentTime = Math.min(Math.max(0, media.currentTime + delta), media.duration || 0)
  }, [])

  const seekTo = useCallback((time: number) => {
    const media = mediaRef.current
    if (media) media.currentTime = time
  }, [])

  const setVolumeClamped = useCallback((v: number) => {
    const media = mediaRef.current
    if (!media) return
    media.volume = Math.min(1, Math.max(0, v))
    media.muted = media.volume === 0
  }, [])

  const toggleMute = useCallback(() => {
    const media = mediaRef.current
    if (media) media.muted = !media.muted
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen().catch(() => {})
  }, [])

  const togglePip = useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {})
    else media.requestPictureInPicture().catch(() => {})
  }, [])

  const toggleCaptions = useCallback(() => {
    if (tracks.length === 0) return
    setActiveTrack((cur) => (cur === null ? tracks[0].id : null))
  }, [tracks])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (!isVideo) return
    hideTimer.current = setTimeout(() => {
      if (mediaRef.current && !mediaRef.current.paused && menu === null) setControlsVisible(false)
    }, HIDE_CONTROLS_AFTER_MS)
  }, [isVideo, menu])

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" && e.key !== " ") return
      const media = mediaRef.current
      if (!media) return
      let handled = true
      switch (e.key) {
        case " ":
        case "k":
          togglePlay()
          break
        case "ArrowLeft":
        case "j":
          seekBy(-SKIP_SECONDS)
          break
        case "ArrowRight":
        case "l":
          seekBy(SKIP_SECONDS)
          break
        case "ArrowUp":
          setVolumeClamped(media.volume + 0.1)
          break
        case "ArrowDown":
          setVolumeClamped(media.volume - 0.1)
          break
        case "m":
          toggleMute()
          break
        case "f":
          if (isVideo) toggleFullscreen()
          break
        case "p":
          if (pipSupported) togglePip()
          break
        case "c":
          toggleCaptions()
          break
        case ",":
          media.playbackRate = Math.max(SPEEDS[0], media.playbackRate - 0.25)
          break
        case ".":
          media.playbackRate = Math.min(SPEEDS[SPEEDS.length - 1], media.playbackRate + 0.25)
          break
        case "Home":
          seekTo(0)
          break
        case "End":
          seekTo(media.duration || 0)
          break
        default:
          if (/^[0-9]$/.test(e.key) && media.duration) {
            seekTo((media.duration * Number(e.key)) / 10)
          } else {
            handled = false
          }
      }
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
        showControls()
      }
    },
    [
      togglePlay,
      seekBy,
      seekTo,
      setVolumeClamped,
      toggleMute,
      toggleFullscreen,
      togglePip,
      toggleCaptions,
      showControls,
      isVideo,
      pipSupported,
    ]
  )

  const activeLabel = tracks.find((t) => t.id === activeTrack)?.label
  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const speedItems: MenuItem[] = SPEEDS.map((s) => ({
    key: String(s),
    label: s === 1 ? "Normal" : `${s}×`,
    active: rate === s,
    onSelect: () => {
      if (mediaRef.current) mediaRef.current.playbackRate = s
    },
  }))

  const captionItems: MenuItem[] = [
    {
      key: "off",
      label: "Off",
      active: activeTrack === null,
      onSelect: () => setActiveTrack(null),
    },
    ...tracks.map((t) => ({
      key: t.id,
      label: t.label,
      active: activeTrack === t.id,
      onSelect: () => setActiveTrack(t.id),
    })),
    {
      key: "load",
      label: "Load subtitle file…",
      active: false,
      onSelect: () => fileInputRef.current?.click(),
    },
  ]

  const hideCursor = isVideo && playing && !controlsVisible

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the player surface is a keyboard-focusable widget
    <div
      ref={containerRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: focus lands here so the shortcut keys work
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (isVideo && playing && menu === null) setControlsVisible(false)
      }}
      className={`group relative flex h-full w-full flex-col justify-end overflow-hidden bg-black outline-none ${
        hideCursor ? "cursor-none" : ""
      }`}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: tracks are attached from sidecar files when present */}
      <video
        ref={mediaRef}
        src={src}
        playsInline
        preload="metadata"
        title={title}
        onClick={togglePlay}
        onDoubleClick={isVideo ? toggleFullscreen : undefined}
        onPlay={() => {
          setPlaying(true)
          showControls()
        }}
        onPause={() => {
          setPlaying(false)
          setControlsVisible(true)
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          setVolume(e.currentTarget.volume)
          setMuted(e.currentTarget.muted)
        }}
        onProgress={(e) => {
          const ranges = e.currentTarget.buffered
          if (ranges.length > 0) setBuffered(ranges.end(ranges.length - 1))
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume)
          setMuted(e.currentTarget.muted)
        }}
        onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        className={isVideo ? "absolute inset-0 h-full w-full" : "hidden"}
      >
        {tracks.map((t) => (
          <track key={t.id} kind="subtitles" label={t.label} src={t.vttUrl} />
        ))}
      </video>

      {isVideo ? null : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-white">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
            <Music className="h-10 w-10" />
          </div>
          <p className="max-w-full truncate font-medium text-sm">{title}</p>
        </div>
      )}

      {cueText ? (
        <div
          className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center px-6 transition-[bottom] ${
            controlsVisible ? "bottom-20" : "bottom-6"
          }`}
        >
          <p className="max-w-[80%] whitespace-pre-line rounded bg-black/70 px-3 py-1 text-center text-lg text-white leading-snug">
            {cueText}
          </p>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) addLocal(file)
          e.target.value = ""
        }}
      />

      <div
        className={`relative z-10 flex shrink-0 flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2 text-white transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="relative h-5 w-full cursor-pointer"
          style={{
            // Played / buffered / remaining as three stops under the native range thumb.
            ["--played" as string]: `${playedPct}%`,
            ["--buffered" as string]: `${Math.max(playedPct, bufferedPct)}%`,
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/40"
              style={{ width: "var(--buffered)" }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-sky-400"
              style={{ width: "var(--played)" }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            aria-label="Seek"
            onChange={(e) => seekTo(Number(e.target.value))}
            className="player-range absolute inset-0 h-full w-full"
          />
        </div>

        <div className="flex items-center gap-1">
          <ControlButton label="Back 10 seconds (←)" onClick={() => seekBy(-SKIP_SECONDS)}>
            <RotateCcw className="h-4 w-4" />
          </ControlButton>
          <ControlButton label={playing ? "Pause (space)" : "Play (space)"} onClick={togglePlay}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </ControlButton>
          <ControlButton label="Forward 10 seconds (→)" onClick={() => seekBy(SKIP_SECONDS)}>
            <RotateCw className="h-4 w-4" />
          </ControlButton>

          <div className="group/vol flex items-center">
            <ControlButton label={muted ? "Unmute (m)" : "Mute (m)"} onClick={toggleMute}>
              <VolumeIcon className="h-4 w-4" />
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => setVolumeClamped(Number(e.target.value))}
              className="player-range w-0 opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100"
            />
          </div>

          <span className="ml-1 whitespace-nowrap font-mono text-white/80 text-xs tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <ControlButton
              label={activeLabel ? `Captions: ${activeLabel} (c)` : "Captions (c)"}
              active={activeTrack !== null}
              onClick={() => setMenu((m) => (m === "captions" ? null : "captions"))}
            >
              {tracks.length === 0 ? (
                <CaptionsOff className="h-4 w-4" />
              ) : (
                <Captions className="h-4 w-4" />
              )}
            </ControlButton>
            {menu === "captions" ? (
              <PlayerMenu title="Captions" items={captionItems} onClose={() => setMenu(null)} />
            ) : null}
          </div>

          <div className="relative">
            <ControlButton
              label={`Speed: ${rate}× (, / .)`}
              active={rate !== 1}
              onClick={() => setMenu((m) => (m === "speed" ? null : "speed"))}
            >
              <Gauge className="h-4 w-4" />
            </ControlButton>
            {menu === "speed" ? (
              <PlayerMenu title="Speed" items={speedItems} onClose={() => setMenu(null)} />
            ) : null}
          </div>

          {pipSupported ? (
            <ControlButton label="Picture in picture (p)" onClick={togglePip}>
              <PictureInPicture2 className="h-4 w-4" />
            </ControlButton>
          ) : null}

          {isVideo ? (
            <ControlButton
              label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </ControlButton>
          ) : null}
        </div>
      </div>
    </div>
  )
}
