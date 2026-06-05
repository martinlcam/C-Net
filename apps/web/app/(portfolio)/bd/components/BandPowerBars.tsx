"use client"

import { useEffect, useRef, useState } from "react"
import type { EegSample } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

/**
 * BandPowerBars — live EEG spectral band powers (delta…gamma).
 *
 * Signal chain, per 1-second window, per channel:
 *
 *   raw µV  →  linear detrend  →  0.5 Hz high-pass  →  Hann window  →  FFT  →
 *   sum power in each band  →  average across the 4 channels
 *
 * Then two display modes (toggle in the corner):
 *
 *   • REL %  — each band as a share of the total band power (sums to ~100%).
 *             Good for watching ONE band's slice grow/shrink over time (e.g.
 *             relative alpha rising as you relax). Because EEG is 1/f, delta
 *             always takes the biggest share — that's physiology, not a bug.
 *
 *   • LOG dB — each band's power on a log scale, expressed in dB below the
 *             loudest band. log() compresses the huge 1/f range so every band
 *             is comparable and you can watch each band's OWN level move
 *             independently. This mirrors what the Muse app shows.
 *
 * Two cleanups run continuously:
 *   • artifact rejection — windows with a huge excursion (blink / jaw clench /
 *     head turn) are dropped and the bars freeze with a ⚠ MOTION badge, because
 *     motion artifacts are 10-100× brain amplitude and would swamp the bands.
 *   • temporal smoothing — an EMA (~1.3 s) so you read trends, not per-window jitter.
 */

type Props = {
  buffer: BdRingBuffer
  sampleRate?: number
}

// Standard EEG bands. Ranges match Mind Monitor / the Muse SDK convention
// (gamma capped at 44 Hz — above that is mostly EMG/line noise, not brain).
const BANDS: Array<[name: string, low: number, high: number]> = [
  ["DELTA", 1, 4],
  ["THETA", 4, 8],
  ["ALPHA", 8, 13],
  ["BETA", 13, 30],
  ["GAMMA", 30, 44],
]

const WINDOW_SIZE = 256 // 1 second @ 256 Hz, conveniently power-of-two.

// High-pass cutoff. Removes sub-delta drift — breathing (~0.3 Hz), sweat, and
// slow body sway — while leaving the delta band (1-4 Hz) itself intact. So this
// does NOT shrink delta artificially; it strips the junk that sits *below* delta.
const HIGHPASS_HZ = 0.5

// A detrended window whose peak excursion exceeds this (µV) is almost certainly
// a blink, jaw clench, or head movement — not brain activity. We freeze the bars
// during these so motion artifacts don't masquerade as a theta/delta surge.
const ARTIFACT_UV = 220

// EMA factor for the displayed values. At ~6 Hz updates this is a ~1.3 s time
// constant — slow enough to read trends (eyes-closed alpha creeping up) over the
// per-window noise, fast enough to still feel live.
const SMOOTH = 0.12

// LOG-mode display: how many dB below the loudest band maps to an empty bar.
const LOG_RANGE_DB = 36
// Floor added before log10() so a silent band can't produce -Infinity.
const LOG_EPS = 1e-6

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

/**
 * 2nd-order Butterworth high-pass biquad coefficients (RBJ cookbook formulation),
 * normalized by a0. Q = 1/√2 gives the maximally-flat Butterworth response.
 */
function highpassCoeffs(fs: number, fc: number): Biquad {
  const w0 = (2 * Math.PI * fc) / fs
  const cosw = Math.cos(w0)
  const sinw = Math.sin(w0)
  const alpha = sinw / (2 * Math.SQRT1_2)

  const b0 = (1 + cosw) / 2
  const b1 = -(1 + cosw)
  const b2 = (1 + cosw) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosw
  const a2 = 1 - alpha

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

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

/** Hann window — tapers the window edges to zero to reduce spectral leakage. */
const HANN = (() => {
  const w = new Float64Array(WINDOW_SIZE)
  for (let i = 0; i < WINDOW_SIZE; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (WINDOW_SIZE - 1)))
  }
  return w
})()

function computeBands(
  ring: BdRingBuffer["eeg"],
  sampleRate: number,
  hp: Biquad
): { values: number[]; artifact: boolean } {
  const N = WINDOW_SIZE
  const have = Math.min(N, ring.pushed)
  if (have < N) {
    return { values: BANDS.map(() => 0), artifact: false }
  }

  const half = N / 2
  const power = new Float64Array(half)
  const re = new Float64Array(N)
  const im = new Float64Array(N)

  // Closed-form least-squares constants over i = 0..N-1 (window index as x).
  const sumI = ((N - 1) * N) / 2
  const sumI2 = ((N - 1) * N * (2 * N - 1)) / 6
  const denom = N * sumI2 - sumI * sumI

  let maxAbs = 0 // largest detrended excursion across all channels → artifact gate

  for (let ch = 0; ch < 4; ch++) {
    // --- 1. gather this channel's window + accumulate detrend sums -----------
    let sumY = 0
    let sumIY = 0
    for (let i = 0; i < N; i++) {
      const idx = (ring.head - N + i + ring.cap) % ring.cap
      const v = (ring.samples[idx] as EegSample)[ch]
      re[i] = v
      sumY += v
      sumIY += i * v
    }

    // --- 2. linear detrend in place (kills DC + any linear ramp) -------------
    const slope = (N * sumIY - sumI * sumY) / denom
    const intercept = (sumY - slope * sumI) / N
    for (let i = 0; i < N; i++) {
      const det = re[i] - (intercept + slope * i)
      const mag = det < 0 ? -det : det
      if (mag > maxAbs) maxAbs = mag // gate on the detrended (pre-filter) signal
      re[i] = det
    }

    // --- 3. 0.5 Hz high-pass (direct-form-1 biquad), then Hann window --------
    // History starts at rest; the detrended signal is already ~0-mean so the
    // cold-start transient is tiny, and Hann tapers the first samples to ~0.
    let x1 = 0
    let x2 = 0
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < N; i++) {
      const x0 = re[i]
      const y0 = hp.b0 * x0 + hp.b1 * x1 + hp.b2 * x2 - hp.a1 * y1 - hp.a2 * y2
      x2 = x1
      x1 = x0
      y2 = y1
      y1 = y0
      re[i] = y0 * HANN[i]
      im[i] = 0
    }

    // --- 4. FFT + accumulate this channel's power spectrum -------------------
    fft(re, im)
    for (let k = 0; k < half; k++) {
      power[k] += re[k] * re[k] + im[k] * im[k]
    }
  }

  // --- 5. sum the power in each band's bins (averaged per bin) ---------------
  const binHz = sampleRate / N
  const out = BANDS.map(([, lo, hi]) => {
    const loBin = Math.max(1, Math.floor(lo / binHz))
    const hiBin = Math.min(half - 1, Math.ceil(hi / binHz))
    let p = 0
    for (let k = loBin; k <= hiBin; k++) {
      p += power[k]
    }
    return p / Math.max(1, hiBin - loBin + 1)
  })

  return { values: out, artifact: maxAbs > ARTIFACT_UV }
}

type Mode = "rel" | "log"

export function BandPowerBars({ buffer, sampleRate = 256 }: Props) {
  const [values, setValues] = useState<number[]>(() => BANDS.map(() => 0))
  const [noisy, setNoisy] = useState(false)
  const [mode, setMode] = useState<Mode>("rel")

  const smoothRef = useRef<number[]>(BANDS.map(() => 0))
  // Loudest band on a log scale, attack-fast / release-slow. The 0-dB reference
  // for LOG mode. Tracked here so it persists across frames and modes.
  const peakLogRef = useRef<number>(Number.NEGATIVE_INFINITY)
  const rafRef = useRef(0)

  // Recompute the high-pass coefficients only when the sample rate changes.
  const hpRef = useRef<Biquad>(highpassCoeffs(sampleRate, HIGHPASS_HZ))
  useEffect(() => {
    hpRef.current = highpassCoeffs(sampleRate, HIGHPASS_HZ)
  }, [sampleRate])

  useEffect(() => {
    let lastCompute = 0
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      // Recompute at ~6 Hz — FFT is the most expensive thing on this page.
      if (now - lastCompute < 160) return
      lastCompute = now

      const { values: raw, artifact } = computeBands(buffer.eeg, sampleRate, hpRef.current)
      setNoisy(artifact)
      // On a motion/blink artifact, hold the last good estimate rather than
      // letting garbage spike the bars.
      if (artifact) return

      const sm = smoothRef.current
      for (let i = 0; i < sm.length; i++) {
        sm[i] = sm[i] * (1 - SMOOTH) + (raw[i] ?? 0) * SMOOTH
      }

      // Track the loudest band (log scale) for LOG-mode normalization.
      let maxLog = Number.NEGATIVE_INFINITY
      for (let i = 0; i < sm.length; i++) {
        const lp = Math.log10(sm[i] + LOG_EPS)
        if (lp > maxLog) maxLog = lp
      }
      const pk = peakLogRef.current
      peakLogRef.current =
        !Number.isFinite(pk) || maxLog > pk ? maxLog : pk * 0.995 + maxLog * 0.005

      setValues([...sm])
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [buffer, sampleRate])

  // --- derive per-band bar height + label for the active mode ----------------
  const total = values.reduce((a, b) => a + b, 0) || 1
  const peakLog = Number.isFinite(peakLogRef.current)
    ? peakLogRef.current
    : Math.log10(total + LOG_EPS)

  return (
    <div className="relative grid grid-cols-5 gap-2 px-3 pt-7 pb-3 h-full">
      {/* REL ↔ LOG toggle */}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "rel" ? "log" : "rel"))}
        title={
          mode === "rel"
            ? "Showing each band's SHARE of total power. Click for per-band level (dB)."
            : "Showing each band's LEVEL in dB below the loudest band. Click for share of total."
        }
        className="pointer-events-auto absolute left-3 top-2 z-10 border border-bd-rule px-1.5 py-0.5 font-bd-mono text-[9px] uppercase tracking-[0.2em] text-bd-cream/55 transition-colors hover:border-bd-live hover:text-bd-live"
      >
        {mode === "rel" ? "REL %" : "LOG dB"}
      </button>

      {noisy && (
        <div className="pointer-events-none absolute right-3 top-2 z-10 font-bd-mono text-[9px] uppercase tracking-[0.2em] text-bd-alarm bd-pulse">
          ⚠ MOTION
        </div>
      )}

      {BANDS.map(([name, lo, hi], i) => {
        const v = values[i] ?? 0

        let heightPct: number
        let label: string
        if (mode === "rel") {
          const pct = Math.min(1, v / total) // 0..1 share of total
          heightPct = Math.max(2, Math.round(pct * 100))
          label = `${(pct * 100).toFixed(0).padStart(2, "0")}%`
        } else {
          // dB relative to the loudest band (always ≤ 0). Bar fills from the
          // -LOG_RANGE_DB floor up to 0 dB at the peak band.
          const db = 10 * (Math.log10(v + LOG_EPS) - peakLog)
          const frac = Math.min(1, Math.max(0.02, 1 + db / LOG_RANGE_DB))
          heightPct = Math.round(frac * 100)
          label = `${db <= -99 ? "−99" : db.toFixed(0)} dB`
        }

        return (
          <div
            key={name}
            className={`flex flex-col items-stretch justify-end gap-1.5 min-h-0 transition-opacity ${
              noisy ? "opacity-40" : "opacity-100"
            }`}
          >
            <div className="relative flex-1 bg-bd-cream/[0.04] border border-bd-rule overflow-hidden">
              <div
                className="absolute inset-x-0 bottom-0 bg-bd-live transition-[height] duration-300 ease-out"
                style={{ height: `${heightPct}%` }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bd-hatch"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/80 flex items-baseline justify-between">
              <span>{name}</span>
              <span className="text-bd-cream/40">
                {lo}–{hi} Hz
              </span>
            </div>
            <div className="font-bd-mono text-[11px] text-bd-live tabular-nums">{label}</div>
          </div>
        )
      })}
    </div>
  )
}
