"use client"

import {
  Captions,
  CaptionsOff,
  Gauge,
  LocateFixed,
  Music,
  PictureInPicture2,
  Smartphone,
} from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PanoramaView, type PanoramaViewHandle, useGyroSupport } from "./PanoramaView"
import type { Calibration } from "./panorama"
import { toggleFullscreen as enterOrLeaveFullscreen, useFullscreenState } from "./player/fullscreen"
import { MenuOption, MenuSection, PlayerMenu, useDismissMenus } from "./player/player-menu"
import { PlayerShell, type PlayerShellHandle } from "./player/player-shell"
import { srtToVtt } from "./subtitles"
import { useIsMobile } from "./use-is-mobile"

/** A subtitle file to offer in the captions menu; fetched and converted to WebVTT lazily. */
export type SubtitleSource = { id: string; label: string; url: string }

type LoadedTrack = { id: string; label: string; vttUrl: string }

const SKIP_SECONDS = 10
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

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

function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded p-1 hover:text-white/80 ${active ? "text-sky-300" : ""}`}
    >
      {children}
    </button>
  )
}

/**
 * The vault's player for a plain video or audio file: the shared player chrome around one
 * <video>, plus sidecar captions, speed, picture-in-picture and, for a dual-fisheye
 * 360 clip, the stitcher with its gyro and recenter buttons.
 */
export function MediaPlayer({
  kind,
  src,
  title,
  subtitles,
  panorama = false,
  calibration,
}: {
  kind: "video" | "audio"
  src: string
  title: string
  subtitles: SubtitleSource[]
  /** Dual-fisheye 360 video: draw through the stitcher instead of showing the flat frame. */
  panorama?: boolean
  calibration?: Calibration
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<PlayerShellHandle>(null)
  const panoRef = useRef<PanoramaViewHandle>(null)
  const [gyro, setGyro] = useState(false)
  const gyroSupported = useGyroSupport()
  const mobile = useIsMobile()

  const { tracks, addLocal } = useSubtitleTracks(subtitles)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [activeTrack, setActiveTrack] = useState<string | null>(null)
  const [menu, setMenu] = useState<"speed" | "captions" | null>(null)
  const [isFullscreen, setIsFullscreen] = useFullscreenState()

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

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    const textTracks = media.textTracks
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].mode = tracks[i]?.id === activeTrack ? "showing" : "disabled"
    }
  }, [tracks, activeTrack])

  const togglePlay = useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    if (media.paused) media.play().catch(() => {})
    else media.pause()
  }, [])

  // Reflect a seek in the controls at once rather than on the next timeupdate.
  const seekTo = useCallback((time: number) => {
    const media = mediaRef.current
    if (!media) return
    const clamped = Math.min(Math.max(0, time), media.duration || time)
    media.currentTime = clamped
    setCurrentTime(clamped)
  }, [])

  const skip = useCallback(
    (delta: number) => {
      const media = mediaRef.current
      if (media) seekTo(media.currentTime + delta)
    },
    [seekTo]
  )

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

  const toggleFullscreen = useCallback(
    () => enterOrLeaveFullscreen(containerRef.current, mediaRef.current, setIsFullscreen),
    [setIsFullscreen]
  )

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

  const closeMenus = useCallback(() => setMenu(null), [])
  useDismissMenus(menu !== null, closeMenus)

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
          skip(-SKIP_SECONDS)
          break
        case "ArrowRight":
        case "l":
          skip(SKIP_SECONDS)
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
        case "r":
          if (panorama) panoRef.current?.recenter()
          else handled = false
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
        shellRef.current?.revealUi()
      }
    },
    [
      togglePlay,
      skip,
      seekTo,
      setVolumeClamped,
      toggleMute,
      toggleFullscreen,
      togglePip,
      toggleCaptions,
      isVideo,
      pipSupported,
      panorama,
    ]
  )

  const activeLabel = tracks.find((t) => t.id === activeTrack)?.label

  return (
    <PlayerShell
      ref={shellRef}
      containerRef={containerRef}
      containerProps={{ tabIndex: 0, onKeyDown }}
      state={{ playing, current: currentTime, duration, muted, volume, fullscreen: isFullscreen }}
      actions={{
        togglePlay,
        seekTo,
        skip,
        toggleMute,
        setVolume: setVolumeClamped,
        toggleFullscreen,
      }}
      skipSeconds={SKIP_SECONDS}
      mobile={mobile}
      autoHide={isVideo}
      menuOpen={menu !== null}
      tools={
        <>
          {panorama && gyroSupported ? (
            <ToolButton
              label={gyro ? "Stop following the phone" : "Look around by moving the phone"}
              active={gyro}
              onClick={() => panoRef.current?.setGyro(!gyro)}
            >
              <Smartphone className="h-6 w-6" />
            </ToolButton>
          ) : null}
          {panorama ? (
            <ToolButton label="Look straight ahead (r)" onClick={() => panoRef.current?.recenter()}>
              <LocateFixed className="h-6 w-6" />
            </ToolButton>
          ) : null}
          <PlayerMenu
            open={menu === "captions"}
            onToggle={() => setMenu((m) => (m === "captions" ? null : "captions"))}
            label={activeLabel ? `Captions: ${activeLabel} (c)` : "Captions (c)"}
            icon={
              tracks.length === 0 ? (
                <CaptionsOff className="h-6 w-6" />
              ) : (
                <Captions className="h-6 w-6" />
              )
            }
            active={activeTrack !== null}
            mobile={mobile}
            panelClassName="w-56"
          >
            <MenuSection title="Captions">
              <MenuOption
                active={activeTrack === null}
                onSelect={() => {
                  setActiveTrack(null)
                  setMenu(null)
                }}
              >
                Off
              </MenuOption>
              {tracks.map((t) => (
                <MenuOption
                  key={t.id}
                  active={activeTrack === t.id}
                  onSelect={() => {
                    setActiveTrack(t.id)
                    setMenu(null)
                  }}
                >
                  {t.label}
                </MenuOption>
              ))}
              <MenuOption
                active={false}
                onSelect={() => {
                  setMenu(null)
                  fileInputRef.current?.click()
                }}
              >
                Load subtitle file…
              </MenuOption>
            </MenuSection>
          </PlayerMenu>
          <PlayerMenu
            open={menu === "speed"}
            onToggle={() => setMenu((m) => (m === "speed" ? null : "speed"))}
            label={`Speed: ${rate}× (, / .)`}
            icon={<Gauge className="h-6 w-6" />}
            active={rate !== 1}
            mobile={mobile}
            panelClassName="w-40"
          >
            <MenuSection title="Speed">
              {SPEEDS.map((s) => (
                <MenuOption
                  key={s}
                  active={rate === s}
                  onSelect={() => {
                    if (mediaRef.current) mediaRef.current.playbackRate = s
                    setMenu(null)
                  }}
                >
                  {s === 1 ? "Normal" : `${s}×`}
                </MenuOption>
              ))}
            </MenuSection>
          </PlayerMenu>
          {pipSupported && !panorama ? (
            <ToolButton label="Picture in picture (p)" onClick={togglePip}>
              <PictureInPicture2 className="h-6 w-6" />
            </ToolButton>
          ) : null}
        </>
      }
      overlays={
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
      }
    >
      {(picture) => (
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: tracks are attached from sidecar files when present */}
          <video
            ref={mediaRef}
            src={src}
            playsInline
            // A 360 clip should show its scene before play is pressed, so fetch the first frame.
            preload={panorama ? "auto" : "metadata"}
            title={title}
            // The stitcher reads frames into WebGL, which needs a CORS-clean source.
            crossOrigin={panorama ? "anonymous" : undefined}
            onPointerDown={panorama ? undefined : picture.onPointerDown}
            onClick={panorama ? undefined : picture.onClick}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration)
              setVolume(e.currentTarget.volume)
              setMuted(e.currentTarget.muted)
            }}
            onVolumeChange={(e) => {
              setVolume(e.currentTarget.volume)
              setMuted(e.currentTarget.muted)
            }}
            onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
            className={
              panorama
                ? "pointer-events-none absolute h-px w-px opacity-0"
                : isVideo
                  ? "absolute inset-0 h-full w-full"
                  : "hidden"
            }
          >
            {tracks.map((t) => (
              <track key={t.id} kind="subtitles" label={t.label} src={t.vttUrl} />
            ))}
          </video>

          {panorama ? (
            <div className="absolute inset-0" onPointerDown={picture.onPointerDown}>
              <PanoramaView
                ref={panoRef}
                sourceRef={mediaRef}
                live={playing}
                calibration={calibration}
                onTap={picture.onClick}
                onGyroChange={setGyro}
              />
            </div>
          ) : null}

          {isVideo ? null : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-white">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
                <Music className="h-10 w-10" />
              </div>
              <p className="max-w-full truncate font-medium text-sm">{title}</p>
            </div>
          )}
        </>
      )}
    </PlayerShell>
  )
}
