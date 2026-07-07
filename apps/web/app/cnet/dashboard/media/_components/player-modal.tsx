"use client"

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
} from "@/lib/media-api"
import { EpisodePanel } from "./episode-panel"

const SKIP = 5 // seconds for the back/forward skip buttons
const NEXT_CARD_AT = 25 // show the "Up next" card this many seconds before the end
// How many audio tracks to keep warm at once. Each is a full muxed stream (video is
// copied, only audio transcodes, so extra tracks are cheap) — capped so a file with a
// pathological number of audio streams doesn't spin up a dozen sessions.
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

  // Server-provided audio tracks. `audioIndex` is the active (audible) Jellyfin stream
  // index; `undefined` = still loading (gates stream setup so we load the right track
  // once instead of flashing the file's default first). `null` = file default.
  const [audioOpts, setAudioOpts] = useState<AudioTrack[]>([])
  const [audioIndex, setAudioIndex] = useState<number | null | undefined>(undefined)
  // Text subtitle tracks from the API (each a full Stream.vtt, not HLS-segmented).
  const [subTracks, setSubTracks] = useState<SubtitleTrack[]>([])
  // Selected subtitle = Jellyfin stream index, or -1 for off.
  const [curSub, setCurSub] = useState(-1)
  // Seconds into the item where the end credits start (chapter markers), or null.
  const [creditsStart, setCreditsStart] = useState<number | null>(null)
  // Intro/OP [start, end) seconds (from chapters) for the "Skip Intro" button.
  const [intro, setIntro] = useState<{ start: number; end: number } | null>(null)
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

  // The set of audio streams to keep warm (all of them, capped), plus a stable signature
  // so the setup effect rebuilds only on item / track-set change — NOT on audio switch.
  const activeKey = audioIndex ?? AUDIO_DEFAULT
  const audioKeys: number[] =
    audioIndex === undefined
      ? []
      : audioOpts.length <= 1
        ? [activeKey]
        : (() => {
            const keys = audioOpts.map((a) => a.index).slice(0, MAX_PARALLEL_AUDIO)
            if (!keys.includes(activeKey)) keys.push(activeKey)
            return keys.sort((a, b) => a - b)
          })()
  const audioKeysSig = audioKeys.join(",")

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
    setSettingsOpen(false)
    setCurSub(-1)
    wasPlayingRef.current = true
    seekTargetRef.current =
      item.resumePositionTicks > 0 ? item.resumePositionTicks / TICKS_PER_SECOND : 0
    lastPosRef.current = seekTargetRef.current
    getItemTracks(item.id)
      .then((t) => {
        if (cancelled) return
        setAudioOpts(t.audio)
        setSubTracks(t.subtitles)
        setCreditsStart(t.creditsStartSeconds)
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
        setAudioIndex(null) // fall back to the stream's default audio
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  // Full-file WebVTT URL for a subtitle stream, signed via the item's HLS URL and routed
  // through the proxy's .vtt sanitizer. One file with every cue — Jellyfin's 30s HLS
  // subtitle windows drop all cues after the OP for typeset anime ASS.
  const subtitleUrl = (streamIndex: number) =>
    `${mediaUrl(item.hlsUrl)}&path=${encodeURIComponent(`${item.id}/Subtitles/${streamIndex}/0/Stream.vtt`)}`
  const srcFor = (ai: number) =>
    mediaUrl(item.hlsUrl) + (ai !== AUDIO_DEFAULT ? `&audioStreamIndex=${ai}` : "")

  // Build one warm hls.js instance per audio track and attach each to its own <video>.
  // Rebuilt only on item / track-set change — an audio switch reuses these instances.
  // biome-ignore lint/correctness/useExhaustiveDependencies: setup keys on item + track set; other reads are refs
  useEffect(() => {
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
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, onReady)
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src // Safari plays HLS natively.
        video.addEventListener("loadedmetadata", onReady, { once: true })
      }
    }

    return () => {
      void reportStopped(itemId, Math.round(lastPosRef.current * TICKS_PER_SECOND)).catch(() => {})
      for (const h of hlsRefs.current.values()) h.destroy()
      hlsRefs.current.clear()
    }
  }, [item.id, audioKeysSig])

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
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void containerRef.current?.requestFullscreen().catch(() => {})
  }, [])

  const revealUi = useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!getActive()?.paused) setUiVisible(false)
    }, 3000)
  }, [getActive])

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
          if (episodesOpen) setEpisodesOpen(false)
          else if (!document.fullscreenElement) onClose()
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
      className="fixed inset-0 z-50 flex select-none flex-col bg-black"
      onMouseMove={revealUi}
    >
      {audioKeys.map((ai) => {
        const isActive = ai === activeKey
        return (
          // biome-ignore lint/a11y/useMediaCaption: subtitles are selectable, user-controlled tracks
          <video
            key={`${item.id}-${ai}`}
            ref={registerMedia(ai)}
            playsInline
            onClick={togglePlay}
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
                  const v = getActive()
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
              {item.seriesId ? (
                <button
                  type="button"
                  onClick={() => setEpisodesOpen((o) => !o)}
                  aria-label="Episodes"
                  aria-expanded={episodesOpen}
                  title="Episodes"
                  className={`rounded p-1 hover:text-white/80 ${episodesOpen ? "text-white" : ""}`}
                >
                  <ListVideo className="h-6 w-6" />
                </button>
              ) : null}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  aria-label="Audio, subtitles, and speed"
                  aria-expanded={settingsOpen}
                  className={`rounded p-1 hover:text-white/80 ${settingsOpen ? "text-white" : ""}`}
                >
                  <Settings className="h-6 w-6" />
                </button>
                {settingsOpen ? (
                  <div className="absolute right-0 bottom-10 flex w-[30rem] max-w-[calc(100vw-1.5rem)] gap-2 rounded-md bg-neutral-900/95 p-3 text-sm shadow-xl ring-1 ring-white/15">
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
                    <div className="w-20 shrink-0">
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
                  </div>
                ) : null}
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
      {episodesOpen && item.seriesId ? (
        <EpisodePanel
          seriesId={item.seriesId}
          seriesName={item.seriesName}
          currentSeasonId={item.seasonId}
          currentItemId={item.id}
          onSelect={selectEpisode}
          onClose={() => setEpisodesOpen(false)}
        />
      ) : null}
    </div>
  )
}
