"use client"

import { useEffect, useRef } from "react"
import { BD_CHANNELS, type EegSample } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

type Props = {
  buffer: BdRingBuffer
  /** How many seconds of EEG to keep on screen. */
  windowSec?: number
  /** Sample rate (Muse 2 = 256 Hz). */
  sampleRate?: number
}

/**
 * Canvas-based rolling oscilloscope for the 4 Muse EEG channels (TP9 / AF7 /
 * AF8 / TP10). Reads samples directly out of the ring buffer in a requestAnimationFrame
 * loop — the React tree never re-renders on sample arrival, so 256 Hz is cheap.
 *
 * Each channel is centered on its own horizontal lane and auto-scaled to the
 * peak absolute value seen in the visible window, so the trace fills its lane
 * regardless of the signal's actual microvolt range.
 */
export function EegOscilloscope({ buffer, windowSec = 5, sampleRate = 256 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    let width = 0
    let height = 0

    const sync = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    sync()

    const ro = new ResizeObserver(sync)
    ro.observe(container)

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)

    let raf = 0
    const sampleCount = windowSec * sampleRate

    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!width || !height) return

      ctx.clearRect(0, 0, width, height)

      // Hairline grid: 1-second verticals + per-channel baselines.
      ctx.strokeStyle = "rgba(250,246,241,0.06)"
      ctx.lineWidth = 1
      for (let s = 1; s < windowSec; s++) {
        const x = Math.round((s / windowSec) * width) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      const ring = buffer.eeg
      const have = Math.min(sampleCount, ring.pushed)
      if (have < 2) return

      const laneHeight = height / 4
      const labelColor = "rgba(250,246,241,0.32)"
      ctx.font = '10px var(--font-bd-mono), ui-monospace, monospace'
      ctx.textBaseline = "top"

      // For each channel, sweep the ring once to find peak amplitude (auto-gain).
      const peaks: [number, number, number, number] = [1, 1, 1, 1]
      for (let i = 0; i < have; i++) {
        const idx = (ring.head - have + i + ring.cap) % ring.cap
        const s = ring.samples[idx] as EegSample
        for (let c = 0; c < 4; c++) {
          const v = Math.abs(s[c])
          if (v > peaks[c]) peaks[c] = v
        }
      }
      // Pad peaks so the trace doesn't kiss the lane edge.
      for (let c = 0; c < 4; c++) peaks[c] = Math.max(peaks[c], 8) * 1.1

      // Lane separators + labels.
      ctx.strokeStyle = "rgba(250,246,241,0.10)"
      for (let c = 1; c < 4; c++) {
        const y = Math.round(c * laneHeight) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.fillStyle = labelColor
      for (let c = 0; c < 4; c++) {
        const y = c * laneHeight + 6
        ctx.fillText(BD_CHANNELS.EEG[c], 8, y)
        ctx.fillText(`${peaks[c].toFixed(0)} uV`, width - 56, y)
      }

      // Plot each channel.
      ctx.lineWidth = 1.25
      const stepX = width / (sampleCount - 1)
      for (let c = 0; c < 4; c++) {
        ctx.strokeStyle = c === 0 || c === 3 ? "#ad70eb" : "#c6ff00"
        ctx.beginPath()
        const laneTop = c * laneHeight
        const laneMid = laneTop + laneHeight / 2
        const amp = laneHeight * 0.42
        for (let i = 0; i < have; i++) {
          const idx = (ring.head - have + i + ring.cap) % ring.cap
          const s = ring.samples[idx] as EegSample
          const v = s[c] / peaks[c]
          const x = i * stepX
          const y = laneMid - v * amp
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [buffer, windowSec, sampleRate])

  return (
    <div ref={containerRef} className="relative w-full h-full bd-grid">
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}
