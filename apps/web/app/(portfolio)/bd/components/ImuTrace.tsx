"use client"

import { useEffect, useRef } from "react"
import type { Vec3 } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

type Kind = "acc" | "gyro"

type Props = {
  buffer: BdRingBuffer
  kind: Kind
  /** Visible window in seconds. */
  windowSec?: number
  sampleRate?: number
}

const AXIS_COLORS = ["#faf6f1", "#ad70eb", "#c6ff00"] as const
const AXIS_LABELS = ["X", "Y", "Z"] as const

/**
 * 3-axis IMU line plot for accelerometer or gyroscope. All three axes are
 * drawn into a single lane (no per-axis stacking) so the reader can see how
 * gravity sits on Z, head sway moves X, etc.
 */
export function ImuTrace({ buffer, kind, windowSec = 6, sampleRate = 52 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    let w = 0
    let h = 0
    const sync = () => {
      const r = container.getBoundingClientRect()
      w = r.width
      h = r.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(container)

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const ring = kind === "acc" ? buffer.acc : buffer.gyro
    const sampleCount = windowSec * sampleRate
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!w || !h) return
      ctx.clearRect(0, 0, w, h)
      const have = Math.min(sampleCount, ring.pushed)
      if (have < 2) return

      // Auto-scale to peak abs value across all 3 axes.
      let peak = kind === "acc" ? 1.2 : 30 // sensible floors so the trace doesn't twitch
      for (let i = 0; i < have; i++) {
        const idx = (ring.head - have + i + ring.cap) % ring.cap
        const s = ring.samples[idx] as Vec3
        for (let a = 0; a < 3; a++) {
          const v = Math.abs(s[a])
          if (v > peak) peak = v
        }
      }
      peak *= 1.1

      // Midline.
      ctx.strokeStyle = "rgba(250,246,241,0.10)"
      ctx.beginPath()
      ctx.moveTo(0, Math.round(h / 2) + 0.5)
      ctx.lineTo(w, Math.round(h / 2) + 0.5)
      ctx.stroke()

      const stepX = w / Math.max(1, have - 1)
      const amp = h * 0.42
      const mid = h / 2

      for (let a = 0; a < 3; a++) {
        ctx.strokeStyle = AXIS_COLORS[a]
        ctx.lineWidth = 1.1
        ctx.beginPath()
        for (let i = 0; i < have; i++) {
          const idx = (ring.head - have + i + ring.cap) % ring.cap
          const v = (ring.samples[idx] as Vec3)[a] / peak
          const x = i * stepX
          const y = mid - v * amp
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Axis legend in top-right.
      ctx.font = "10px var(--font-bd-mono), ui-monospace, monospace"
      ctx.textBaseline = "top"
      for (let a = 0; a < 3; a++) {
        ctx.fillStyle = AXIS_COLORS[a]
        ctx.fillText(AXIS_LABELS[a], w - 36 + a * 12, 4)
      }
      ctx.fillStyle = "rgba(250,246,241,0.32)"
      ctx.fillText(`+/-${peak.toFixed(kind === "acc" ? 2 : 0)}`, 8, 4)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [buffer, kind, windowSec, sampleRate])

  return (
    <div ref={containerRef} className="relative w-full h-full bd-grid">
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}
