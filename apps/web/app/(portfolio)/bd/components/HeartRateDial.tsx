"use client"

import { useEffect, useRef, useState } from "react"
import type { Ppg3 } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

type Props = {
  buffer: BdRingBuffer
  sampleRate?: number
}

/**
 * Cheap heart-rate estimator from the Muse 2 PPG infrared channel.
 *
 * Strategy:
 *   1. Take the last ~10 s of the IR channel.
 *   2. Detrend by subtracting a slow moving mean (DC + breathing component).
 *   3. Pick samples that are local maxima above a noise threshold and at
 *      least 300 ms (200 BPM ceiling) after the last peak.
 *   4. BPM = 60 / median inter-peak interval.
 *
 * Not medical-grade. Plenty good enough to make the dial move.
 */
function estimateBpm(ring: BdRingBuffer["ppg"], sampleRate: number): number | null {
  const windowSamples = Math.min(sampleRate * 10, ring.pushed)
  if (windowSamples < sampleRate * 3) return null

  const series = new Float64Array(windowSamples)
  for (let i = 0; i < windowSamples; i++) {
    const idx = (ring.head - windowSamples + i + ring.cap) % ring.cap
    const s = ring.samples[idx] as Ppg3
    series[i] = s[1] // IR channel
  }

  // Moving-mean detrend (1-second window).
  const meanWin = Math.min(sampleRate, windowSamples)
  const detrended = new Float64Array(windowSamples)
  let sum = 0
  for (let i = 0; i < meanWin; i++) sum += series[i]
  for (let i = 0; i < windowSamples; i++) {
    if (i >= meanWin) sum += series[i] - series[i - meanWin]
    const mean = sum / Math.min(meanWin, i + 1)
    detrended[i] = series[i] - mean
  }

  // Adaptive threshold = 40% of the window's positive peak.
  let peak = 0
  for (let i = 0; i < windowSamples; i++) if (detrended[i] > peak) peak = detrended[i]
  if (peak <= 0) return null
  const threshold = peak * 0.4

  const minGap = Math.floor(sampleRate * 0.3) // 200 BPM ceiling
  const peaks: number[] = []
  for (let i = 1; i < windowSamples - 1; i++) {
    const v = detrended[i]
    if (v > threshold && v > detrended[i - 1] && v >= detrended[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minGap) {
        peaks.push(i)
      }
    }
  }
  if (peaks.length < 3) return null

  const intervals: number[] = []
  for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1])
  intervals.sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  const bpm = (60 * sampleRate) / median
  if (bpm < 30 || bpm > 220) return null
  return bpm
}

export function HeartRateDial({ buffer, sampleRate = 64 }: Props) {
  const [bpm, setBpm] = useState<number | null>(null)
  const sparkRef = useRef<HTMLCanvasElement | null>(null)
  const sparkContainerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef(0)

  // Re-estimate BPM at ~2 Hz.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const tick = () => setBpm(estimateBpm(buffer.ppg, sampleRate))
    tick()
    id = setInterval(tick, 500)
    return () => {
      if (id) clearInterval(id)
    }
  }, [buffer, sampleRate])

  // Sparkline of the IR channel.
  useEffect(() => {
    const canvas = sparkRef.current
    const container = sparkContainerRef.current
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

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      if (!w || !h) return
      ctx.clearRect(0, 0, w, h)
      const ring = buffer.ppg
      const samples = Math.min(sampleRate * 6, ring.pushed)
      if (samples < 2) return
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < samples; i++) {
        const idx = (ring.head - samples + i + ring.cap) % ring.cap
        const v = (ring.samples[idx] as Ppg3)[1]
        if (v < min) min = v
        if (v > max) max = v
      }
      const range = max - min || 1
      ctx.strokeStyle = "#c6ff00"
      ctx.lineWidth = 1.25
      ctx.beginPath()
      for (let i = 0; i < samples; i++) {
        const idx = (ring.head - samples + i + ring.cap) % ring.cap
        const v = (ring.samples[idx] as Ppg3)[1]
        const x = (i / (samples - 1)) * w
        const y = h - ((v - min) / range) * (h - 4) - 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    draw()
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [buffer, sampleRate])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline justify-between px-3 pt-3">
        <div>
          <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/60">
            HR.BPM
          </div>
          <div className="font-bd-display text-[64px] leading-none text-bd-cream tabular-nums">
            {bpm === null ? "--" : Math.round(bpm).toString().padStart(3, "0")}
          </div>
        </div>
        <div className="text-right font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/40">
          <div>PPG.IR</div>
          <div>64 HZ</div>
          <div className="text-bd-live bd-pulse mt-1">{bpm === null ? "ACQUIRING" : "LOCK"}</div>
        </div>
      </div>
      <div ref={sparkContainerRef} className="relative w-full flex-1 min-h-[60px]">
        <canvas ref={sparkRef} className="block" />
      </div>
    </div>
  )
}
