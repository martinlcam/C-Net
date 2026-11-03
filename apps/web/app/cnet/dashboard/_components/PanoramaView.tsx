"use client"

import { LocateFixed, Smartphone } from "lucide-react"
import {
  forwardRef,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import {
  type Calibration,
  DEFAULT_CALIBRATION,
  deviceOrientationMatrix,
  type Mat3,
  multiply,
  viewMatrix,
} from "./panorama"
import { createPanoramaRenderer, type PanoramaRenderer, type PanoramaSource } from "./panorama-gl"

const DEG = Math.PI / 180
const DEFAULT_FOV = 95 * DEG
const MIN_FOV = 20 * DEG
const MAX_FOV = 115 * DEG
const MAX_PITCH = 89 * DEG
const TAP_SLOP_PX = 6
const TAP_MS = 300
const FRICTION = 0.94
const SETTLED = 0.00002
const MAX_DPR = 2

export type PanoramaViewHandle = {
  /** Look straight ahead again at the default zoom. */
  recenter(): void
  /**
   * Turn phone orientation on or off. Must be called from a click handler: iOS only grants
   * motion access inside a user gesture. Resolves to the state actually reached.
   */
  setGyro(on: boolean): Promise<boolean>
}

type Props = {
  /** The video or image to draw. Read on every frame, so it may be filled in after mount. */
  sourceRef: RefObject<HTMLVideoElement | null> | RefObject<HTMLImageElement | null>
  /** True while the source produces new frames (a playing video). */
  live: boolean
  calibration?: Calibration
  onTap?: () => void
  onDoubleTap?: () => void
  onGyroChange?: (on: boolean) => void
  className?: string
}

type Pointer = { x: number; y: number }

type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">
}

function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation) return screen.orientation.angle
  const legacy = (window as Window & { orientation?: number }).orientation
  return typeof legacy === "number" ? legacy : 0
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Drag, scroll, pinch and gyro look-around over a dual-fisheye source. Rendering is pulled by a
 * single animation-frame loop that only runs while something changes: a playing video, a drag,
 * leftover inertia, or the phone moving.
 */
export const PanoramaView = forwardRef<PanoramaViewHandle, Props>(function PanoramaView(
  {
    sourceRef,
    live,
    calibration = DEFAULT_CALIBRATION,
    onTap,
    onDoubleTap,
    onGyroChange,
    className,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<PanoramaRenderer | null>(null)
  const [hinted, setHinted] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  // Everything the frame loop reads lives in refs so pointer handlers never re-render React.
  const view = useRef({ yaw: 0, pitch: 0, fov: DEFAULT_FOV })
  const velocity = useRef({ yaw: 0, pitch: 0 })
  const pointers = useRef(new Map<number, Pointer>())
  const drag = useRef<{
    x: number
    y: number
    t: number
    lastMove: number
    moved: boolean
  } | null>(null)
  const pinchDist = useRef(0)
  const lastTap = useRef(0)
  const gyro = useRef<{ matrix: Mat3 | null; align: boolean; yawOffset: number } | null>(null)
  const dirty = useRef(true)
  const frame = useRef(0)
  const liveRef = useRef(live)
  liveRef.current = live
  const callbacks = useRef({ onTap, onDoubleTap, onGyroChange })
  callbacks.current = { onTap, onDoubleTap, onGyroChange }

  const requestDraw = useCallback(() => {
    dirty.current = true
    if (frame.current) return
    const tick = () => {
      frame.current = 0
      const r = renderer.current
      const canvas = canvasRef.current
      if (!r || !canvas) return

      const v = view.current
      let moving = false
      if (!drag.current && (velocity.current.yaw !== 0 || velocity.current.pitch !== 0)) {
        v.yaw += velocity.current.yaw
        v.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, v.pitch + velocity.current.pitch))
        velocity.current.yaw *= FRICTION
        velocity.current.pitch *= FRICTION
        if (Math.hypot(velocity.current.yaw, velocity.current.pitch) < SETTLED) {
          velocity.current = { yaw: 0, pitch: 0 }
        } else {
          moving = true
        }
      }

      const g = gyro.current
      const matrix =
        g?.matrix !== null && g?.matrix !== undefined
          ? multiply(viewMatrix(g.yawOffset, 0), g.matrix)
          : viewMatrix(v.yaw, v.pitch)
      r.setView(matrix, v.fov)
      const drew = r.draw()
      dirty.current = !drew

      if (liveRef.current || moving || dirty.current || g !== null) {
        frame.current = requestAnimationFrame(tick)
      }
    }
    frame.current = requestAnimationFrame(tick)
  }, [])

  // Renderer lifecycle: create once, size with the element, feed it whichever source is set.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = createPanoramaRenderer(canvas)
    if (!r) {
      setUnsupported(true)
      return
    }
    renderer.current = r
    let source: PanoramaSource | null = null
    const sync = () => {
      if (sourceRef.current !== source) {
        source = sourceRef.current
        r.setSource(source)
      }
    }
    sync()
    const poll = setInterval(() => {
      sync()
      if (dirty.current) requestDraw()
    }, 250)

    const parent = canvas.parentElement ?? canvas
    const ro = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect()
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, MAX_DPR))
      requestDraw()
    })
    ro.observe(parent)

    return () => {
      clearInterval(poll)
      ro.disconnect()
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = 0
      r.dispose()
      renderer.current = null
    }
  }, [sourceRef, requestDraw])

  useEffect(() => {
    renderer.current?.setCalibration(calibration)
    requestDraw()
  }, [calibration, requestDraw])

  useEffect(() => {
    if (live) requestDraw()
  }, [live, requestDraw])

  // Wheel must be a non-passive listener so the page behind the player does not scroll.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = view.current
      v.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, v.fov * Math.exp(e.deltaY * 0.0015)))
      requestDraw()
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [requestDraw])

  const stopGyro = useCallback(() => {
    if (!gyro.current) return
    gyro.current = null
    callbacks.current.onGyroChange?.(false)
    requestDraw()
  }, [requestDraw])

  useEffect(() => {
    const onOrientation = (e: DeviceOrientationEvent) => {
      const g = gyro.current
      if (!g || e.alpha === null || e.beta === null || e.gamma === null) return
      g.matrix = deviceOrientationMatrix(e.alpha, e.beta, e.gamma, screenAngle())
      if (g.align) {
        // Keep looking where the user was looking when the gyro came on.
        g.align = false
        const heading = Math.atan2(g.matrix[6], g.matrix[8])
        g.yawOffset = view.current.yaw - heading
      }
      requestDraw()
    }
    window.addEventListener("deviceorientation", onOrientation)
    return () => {
      window.removeEventListener("deviceorientation", onOrientation)
    }
  }, [requestDraw])

  useImperativeHandle(
    ref,
    () => ({
      recenter() {
        view.current = { yaw: 0, pitch: 0, fov: DEFAULT_FOV }
        velocity.current = { yaw: 0, pitch: 0 }
        if (gyro.current?.matrix) {
          const m = gyro.current.matrix
          gyro.current.yawOffset = -Math.atan2(m[6], m[8])
        }
        requestDraw()
      },
      async setGyro(on) {
        if (!on) {
          stopGyro()
          return false
        }
        if (typeof DeviceOrientationEvent === "undefined") return false
        const ctor = DeviceOrientationEvent as OrientationEventCtor
        if (ctor.requestPermission) {
          try {
            if ((await ctor.requestPermission()) !== "granted") return false
          } catch {
            return false
          }
        }
        gyro.current = { matrix: null, align: true, yawOffset: 0 }
        callbacks.current.onGyroChange?.(true)
        // A desktop browser has the API but never fires it; fall back quietly.
        setTimeout(() => {
          if (gyro.current && gyro.current.matrix === null) stopGyro()
        }, 1500)
        requestDraw()
        return true
      },
    }),
    [requestDraw, stopGyro]
  )

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    velocity.current = { yaw: 0, pitch: 0 }
    if (pointers.current.size === 1) {
      const now = performance.now()
      drag.current = { x: e.clientX, y: e.clientY, t: now, lastMove: now, moved: false }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
      drag.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, next)
    const width = e.currentTarget.clientWidth || 1
    const v = view.current

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchDist.current > 0 && dist > 0) {
        v.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, (v.fov * pinchDist.current) / dist))
      }
      pinchDist.current = dist
      requestDraw()
      return
    }

    const d = drag.current
    if (!d) return
    const scale = v.fov / width
    const dYaw = -(next.x - prev.x) * scale
    const dPitch = (next.y - prev.y) * scale
    if (gyro.current) {
      gyro.current.yawOffset += dYaw
    } else {
      v.yaw += dYaw
      v.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, v.pitch + dPitch))
      velocity.current = { yaw: dYaw * 0.9, pitch: dPitch * 0.9 }
    }
    d.lastMove = performance.now()
    if (!d.moved && Math.hypot(next.x - d.x, next.y - d.y) > TAP_SLOP_PX) {
      d.moved = true
      setHinted(true)
    }
    requestDraw()
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) {
      pinchDist.current = 0
      return
    }
    const d = drag.current
    drag.current = null
    if (!d) return
    const now = performance.now()
    if (!d.moved && now - d.t < TAP_MS) {
      velocity.current = { yaw: 0, pitch: 0 }
      callbacks.current.onTap?.()
      if (now - lastTap.current < TAP_MS) {
        lastTap.current = 0
        callbacks.current.onDoubleTap?.()
      } else {
        lastTap.current = now
      }
      return
    }
    // A finger that paused before lifting should not fling the view.
    if (reducedMotion() || gyro.current || now - d.lastMove > 80) {
      velocity.current = { yaw: 0, pitch: 0 }
    }
    requestDraw()
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="360° view. Drag to look around, scroll or pinch to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${className ?? ""}`}
      />
      {unsupported ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">
          This browser can't draw 360° video. The flat file still plays with the download button.
        </p>
      ) : null}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-4 flex justify-center transition-opacity duration-700 ${
          hinted || unsupported ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="rounded-full bg-black/55 px-3 py-1 text-white/90 text-xs backdrop-blur">
          Drag to look around
        </span>
      </div>
    </>
  )
})

/** Recenter and gyro buttons for a 360 surface; styled for the dark player chrome. */
export function PanoramaToolbar({
  onRecenter,
  gyro,
  gyroSupported,
  onToggleGyro,
  className,
}: {
  onRecenter: () => void
  gyro: boolean
  gyroSupported: boolean
  onToggleGyro: () => void
  className?: string
}) {
  const button =
    "flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {gyroSupported ? (
        <button
          type="button"
          title={gyro ? "Stop following the phone" : "Look around by moving the phone"}
          aria-label={gyro ? "Stop following the phone" : "Look around by moving the phone"}
          aria-pressed={gyro}
          onClick={onToggleGyro}
          className={`${button} ${gyro ? "text-sky-300" : ""}`}
        >
          <Smartphone className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        title="Look straight ahead"
        aria-label="Look straight ahead"
        onClick={onRecenter}
        className={button}
      >
        <LocateFixed className="h-4 w-4" />
      </button>
    </div>
  )
}

/** True on touch devices that expose orientation events; read after mount for SSR parity. */
export function useGyroSupport(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(
      typeof DeviceOrientationEvent !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches
    )
  }, [])
  return supported
}
