"use client"

import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { cn } from "@/lib/utils"
import { SeekBar, type Trickplay } from "./seek-bar"

const HIDE_AFTER_MS = 3000

export type PlayerState = {
  playing: boolean
  current: number
  duration: number
  muted: boolean
  volume: number
  fullscreen: boolean
}

export type PlayerActions = {
  togglePlay: () => void
  seekTo: (t: number) => void
  skip: (seconds: number) => void
  toggleMute: () => void
  setVolume: (v: number) => void
  toggleFullscreen: () => void
}

/** Handlers the picture (video elements, a 360 canvas) spreads onto itself. */
export type PictureProps = {
  onPointerDown: (e: React.PointerEvent) => void
  onClick: () => void
}

export type PlayerShellHandle = {
  /** Show the controls and re-arm the hide timer (keyboard shortcuts call this). */
  revealUi: () => void
  hideUi: () => void
}

type Props = {
  containerRef?: RefObject<HTMLDivElement | null>
  className?: string
  /** Extra attributes for the container (the vault player takes focus for its shortcuts). */
  containerProps?: HTMLAttributes<HTMLDivElement>
  /** Title and close button in the top bar; with neither, no top bar is drawn. */
  title?: ReactNode
  onClose?: () => void
  state: PlayerState
  actions: PlayerActions
  skipSeconds: number
  mobile: boolean
  /** Hide the controls while playing (off for audio, where there is nothing to uncover). */
  autoHide?: boolean
  /** A menu or panel is open: keep the controls up, nothing moves the mouse while reading it. */
  menuOpen?: boolean
  trickplay?: Trickplay | null
  sheetUrl?: (sheet: number) => string
  /** Buttons after the skip controls in the bottom row (next episode). */
  transportExtra?: ReactNode
  /** The right-hand cluster of the bottom row, before the fullscreen button (menus). */
  tools?: ReactNode
  /** Drawn over the picture, under nothing: notices, cards, side panels. */
  overlays?: ReactNode
  /** The picture itself, given the press handlers it should spread onto its elements. */
  children: (picture: PictureProps) => ReactNode
}

/**
 * The chrome every video player shares: a gradient overlay with the title, a big centre
 * transport, the scrubber and the bottom row, which auto-hides while playing and comes
 * back on mouse movement or a tap. On touch, a tap on a hidden-controls picture only
 * reveals the controls; with them up, a tap puts them away the way phone players do, and
 * pause lives on the button. A mouse click keeps toggling playback.
 */
export const PlayerShell = forwardRef<PlayerShellHandle, Props>(function PlayerShell(
  {
    containerRef,
    className,
    containerProps,
    title,
    onClose,
    state,
    actions,
    skipSeconds,
    mobile,
    autoHide = true,
    menuOpen = false,
    trickplay = null,
    sheetUrl,
    transportExtra,
    tools,
    overlays,
    children,
  },
  ref
) {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uiVisible, setUiVisible] = useState(true)
  const uiVisibleRef = useRef(true)
  uiVisibleRef.current = uiVisible
  // Set at touchstart, consumed by the click that follows it.
  const tapWasReveal = useRef(false)
  // What pressed the picture last: a finger dismisses, a mouse toggles playback.
  const lastPointerType = useRef("mouse")
  const playingRef = useRef(state.playing)
  playingRef.current = state.playing
  const menuOpenRef = useRef(menuOpen)
  menuOpenRef.current = menuOpen
  const scrubbingRef = useRef(false)
  const autoHideRef = useRef(autoHide)
  autoHideRef.current = autoHide

  const revealUi = useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (!autoHideRef.current) return
    hideTimer.current = setTimeout(() => {
      if (playingRef.current && !menuOpenRef.current && !scrubbingRef.current) setUiVisible(false)
    }, HIDE_AFTER_MS)
  }, [])

  const hideUi = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (autoHideRef.current) setUiVisible(false)
  }, [])

  useImperativeHandle(ref, () => ({ revealUi, hideUi }), [revealUi, hideUi])

  const onScrubbing = useCallback(
    (active: boolean) => {
      scrubbingRef.current = active
      // Letting go re-arms the hide timer, which may have fired (and done nothing) mid-drag.
      if (!active) revealUi()
    },
    [revealUi]
  )

  const onPictureTap = useCallback(() => {
    if (tapWasReveal.current) {
      tapWasReveal.current = false
      return
    }
    if (lastPointerType.current === "touch") hideUi()
    else actions.togglePlay()
  }, [hideUi, actions.togglePlay])

  // Pausing brings the controls back; closing a menu re-arms the hide timer, which may
  // have fired (and done nothing) while the menu was open.
  useEffect(() => {
    if (!state.playing || !menuOpen) revealUi()
  }, [state.playing, menuOpen, revealUi])

  useEffect(() => {
    revealUi()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [revealUi])

  const picture: PictureProps = {
    onPointerDown: (e) => {
      lastPointerType.current = e.pointerType
    },
    onClick: onPictureTap,
  }

  const hideCursor = state.playing && !uiVisible
  const PlayIcon = state.playing ? Pause : Play

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: player chrome reveals controls on mouse move; not a control itself
    <div
      ref={containerRef}
      {...containerProps}
      className={cn(
        "relative flex h-full w-full select-none flex-col overflow-hidden bg-black outline-none [-webkit-tap-highlight-color:transparent]",
        hideCursor && "cursor-none",
        className,
        containerProps?.className
      )}
      onMouseMove={revealUi}
      onTouchStart={() => {
        tapWasReveal.current = !uiVisibleRef.current
        revealUi()
      }}
    >
      {children(picture)}

      {overlays}

      {/* Controls overlay. Its rows span the full width, so a press that lands on a row
          but not on a control bubbles up here and counts as a press on the picture. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: forwards presses on empty overlay space to the picture */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard playback control belongs to the owning player */}
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
        {title !== undefined || onClose ? (
          <div className="pointer-events-auto flex items-start justify-between gap-3 p-4 text-white">
            <span className="min-w-0 truncate font-medium text-lg drop-shadow">{title}</span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close player"
                className="rounded-full p-1 hover:bg-white/20"
              >
                <X className="h-7 w-7" />
              </button>
            ) : null}
          </div>
        ) : (
          <div />
        )}

        {/* Center transport */}
        <div className="pointer-events-auto flex items-center justify-center gap-10 text-white">
          <button
            type="button"
            onClick={() => actions.skip(-skipSeconds)}
            aria-label={`Back ${skipSeconds} seconds`}
            className="relative rounded-full p-2 hover:bg-white/15"
          >
            <RotateCcw className="h-12 w-12" />
            <span className="absolute inset-0 flex items-center justify-center font-bold text-[11px]">
              {skipSeconds}
            </span>
          </button>
          <button
            type="button"
            onClick={actions.togglePlay}
            aria-label={state.playing ? "Pause" : "Play"}
            className="rounded-full bg-white/10 p-4 hover:bg-white/20"
          >
            <PlayIcon className="h-12 w-12" />
          </button>
          <button
            type="button"
            onClick={() => actions.skip(skipSeconds)}
            aria-label={`Forward ${skipSeconds} seconds`}
            className="relative rounded-full p-2 hover:bg-white/15"
          >
            <RotateCw className="h-12 w-12" />
            <span className="absolute inset-0 flex items-center justify-center font-bold text-[11px]">
              {skipSeconds}
            </span>
          </button>
        </div>

        {/* Bottom bar */}
        <div className="pointer-events-auto flex flex-col gap-2 p-4 text-white">
          <SeekBar
            current={state.current}
            duration={state.duration}
            trickplay={trickplay}
            sheetUrl={sheetUrl}
            mobile={mobile}
            onSeek={actions.seekTo}
            onScrubbing={onScrubbing}
          />

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={actions.togglePlay}
              aria-label={state.playing ? "Pause" : "Play"}
              className="hover:text-white/80"
            >
              <PlayIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => actions.skip(-skipSeconds)}
              aria-label={`Back ${skipSeconds} seconds`}
              className="relative hover:text-white/80"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="absolute inset-0 flex items-center justify-center font-bold text-[7px]">
                {skipSeconds}
              </span>
            </button>
            <button
              type="button"
              onClick={() => actions.skip(skipSeconds)}
              aria-label={`Forward ${skipSeconds} seconds`}
              className="relative hover:text-white/80"
            >
              <RotateCw className="h-6 w-6" />
              <span className="absolute inset-0 flex items-center justify-center font-bold text-[7px]">
                {skipSeconds}
              </span>
            </button>
            {transportExtra}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={actions.toggleMute}
                aria-label={state.muted ? "Unmute" : "Mute"}
                className="hover:text-white/80"
              >
                {state.muted || state.volume === 0 ? (
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
                value={state.muted ? 0 : state.volume}
                onChange={(e) => actions.setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              {tools}
              <button
                type="button"
                onClick={actions.toggleFullscreen}
                aria-label={state.fullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="hover:text-white/80"
              >
                {state.fullscreen ? (
                  <Minimize className="h-6 w-6" />
                ) : (
                  <Maximize className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
