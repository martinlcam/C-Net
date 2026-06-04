"use client"

import { useEffect, useRef, useState } from "react"
import type { EegSample } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

type Props = {
  buffer: BdRingBuffer
  sampleRate?: number
}

// Standard EEG bands.
const BANDS: Array<[name: string, low: number, high: number]> = [
  ["DELTA", 1, 4],
  ["THETA", 4, 8],
  ["ALPHA", 8, 13],
  ["BETA", 13, 30],
  ["GAMMA", 30, 50],
]

/**
 * Smallest possible radix-2 iterative Cooley-Tukey FFT, in-place on a Float64
 * pair of arrays. Input length MUST be a power of two.
 */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  // Bit-reversal permutation.
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  // Butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wlre = Math.cos(ang)
    const wlim = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let wre = 1
      let wim = 0
      const half = len >> 1
      for (let k = 0; k < half; k++) {
        const ure = re[i + k]
        const uim = im[i + k]
        const vre = re[i + k + half] * wre - im[i + k + half] * wim
        const vim = re[i + k + half] * wim + im[i + k + half] * wre
        re[i + k] = ure + vre
        im[i + k] = uim + vim
        re[i + k + half] = ure - vre
        im[i + k + half] = uim - vim
        const nwre = wre * wlre - wim * wlim
        wim = wre * wlim + wim * wlre
        wre = nwre
      }
    }
  }
}

const WINDOW_SIZE = 256 // 1 second @ 256 Hz, conveniently power-of-two.

/** Hann window — reduces spectral leakage. */
const HANN = (() => {
  const w = new Float64Array(WINDOW_SIZE)
  for (let i = 0; i < WINDOW_SIZE; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (WINDOW_SIZE - 1)))
  }
  return w
})()

function computeBands(
  ring: BdRingBuffer["eeg"],
  sampleRate: number
): { values: number[]; channelPower: number } {
  const have = Math.min(WINDOW_SIZE, ring.pushed)
  if (have < WINDOW_SIZE) {
    return { values: BANDS.map(() => 0), channelPower: 0 }
  }
  // Average across the 4 channels for one composite spectrum (cheap; per-channel
  // would be 4x the FFT work).
  const re = new Float64Array(WINDOW_SIZE)
  const im = new Float64Array(WINDOW_SIZE)
  for (let i = 0; i < WINDOW_SIZE; i++) {
    const idx = (ring.head - WINDOW_SIZE + i + ring.cap) % ring.cap
    const s = ring.samples[idx] as EegSample
    re[i] = ((s[0] + s[1] + s[2] + s[3]) / 4) * HANN[i]
  }
  fft(re, im)

  const binHz = sampleRate / WINDOW_SIZE
  const out = BANDS.map(([, lo, hi]) => {
    const loBin = Math.max(1, Math.floor(lo / binHz))
    const hiBin = Math.min(WINDOW_SIZE / 2 - 1, Math.ceil(hi / binHz))
    let p = 0
    for (let k = loBin; k <= hiBin; k++) {
      p += re[k] * re[k] + im[k] * im[k]
    }
    return p / Math.max(1, hiBin - loBin + 1)
  })
  const total = out.reduce((a, b) => a + b, 0)
  return { values: out, channelPower: total }
}

export function BandPowerBars({ buffer, sampleRate = 256 }: Props) {
  const [values, setValues] = useState<number[]>(() => BANDS.map(() => 0))
  const [total, setTotal] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    let lastCompute = 0
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      // Recompute at ~6 Hz — FFT is the most expensive thing on this page.
      if (now - lastCompute < 160) return
      lastCompute = now
      const { values, channelPower } = computeBands(buffer.eeg, sampleRate)
      setValues(values)
      setTotal(channelPower)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [buffer, sampleRate])

  const norm = total > 0 ? total : 1
  return (
    <div className="grid grid-cols-5 gap-2 px-3 py-3 h-full">
      {BANDS.map(([name, lo, hi], i) => {
        const v = values[i] ?? 0
        const pct = Math.min(1, v / norm) // 0..1 share of total
        const heightPct = Math.max(2, Math.round(pct * 100))
        return (
          <div key={name} className="flex flex-col items-stretch justify-end gap-1.5 min-h-0">
            <div className="relative flex-1 bg-bd-cream/[0.04] border border-bd-rule overflow-hidden">
              <div
                className="absolute inset-x-0 bottom-0 bg-bd-live transition-[height] duration-150 ease-out"
                style={{ height: `${heightPct}%` }}
              />
              <div className="absolute inset-x-0 bottom-0 bd-hatch" style={{ height: `${heightPct}%` }} />
            </div>
            <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/80 flex items-baseline justify-between">
              <span>{name}</span>
              <span className="text-bd-cream/40">
                {lo}–{hi}
              </span>
            </div>
            <div className="font-bd-mono text-[11px] text-bd-live tabular-nums">
              {(pct * 100).toFixed(0).padStart(2, "0")}%
            </div>
          </div>
        )
      })}
    </div>
  )
}
