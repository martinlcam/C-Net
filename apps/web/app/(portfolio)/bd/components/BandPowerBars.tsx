"use client"

import { useEffect, useRef, useState } from "react"
import type { BdRingBuffer } from "../lib/use-bd-stream"

/**
 * BandPowerBars — live EEG band powers (delta…gamma).
 *
 * The heavy DSP happens server-side in the Python bridge (BrainFlow: detrend →
 * 0.5 Hz high-pass → mains notch → Welch PSD → per-band power), arriving as
 * `bands` frames on `buffer.latestBands`. This component only:
 *
 *   • averages the per-channel absolute powers into one spectrum,
 *   • smooths over time so you read trends, not jitter,
 *   • renders one of two views:
 *       REL %  — each band's share of total power (delta-led; that's 1/f physics).
 *       LOG dB — each band's level in dB below the loudest band, so the quiet
 *                bands are readable and each moves with its own activity.
 *
 * There's no motion freeze — the bars stay live through blinks/movement (the
 * bridge filtering handles most of it, and the freeze was more annoying than useful).
 */

const BANDS: ReadonlyArray<[name: string, low: number, high: number]> = [
  ["DELTA", 1, 4],
  ["THETA", 4, 8],
  ["ALPHA", 8, 13],
  ["BETA", 13, 30],
  ["GAMMA", 30, 44],
]

// EMA factor for the displayed values (~1.3 s time constant at ~6 Hz).
const SMOOTH = 0.12
// LOG-mode: dB below the loudest band that maps to an empty bar.
const LOG_RANGE_DB = 36
// Floor before log10() so a silent band can't go to -Infinity.
const LOG_EPS = 1e-6

type Mode = "rel" | "log"

/** Average the bridge's per-channel absolute band powers into one [δ,θ,α,β,γ]. */
function averageChannels(abs: number[][]): number[] {
  const out = [0, 0, 0, 0, 0]
  let n = 0
  for (const ch of abs) {
    if (!ch || ch.length < 5) continue
    for (let b = 0; b < 5; b++) out[b] += ch[b] ?? 0
    n++
  }
  if (n > 0) for (let b = 0; b < 5; b++) out[b] /= n
  return out
}

type Props = { buffer: BdRingBuffer }

export function BandPowerBars({ buffer }: Props) {
  const [values, setValues] = useState<number[]>(() => BANDS.map(() => 0))
  const [hasData, setHasData] = useState(false)
  const [mode, setMode] = useState<Mode>("rel")

  const smoothRef = useRef<number[]>(BANDS.map(() => 0))
  // Loudest band on a log scale (0-dB reference for LOG mode), attack-fast / release-slow.
  const peakLogRef = useRef<number>(Number.NEGATIVE_INFINITY)
  const rafRef = useRef(0)

  useEffect(() => {
    let last = 0
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      if (now - last < 160) return
      last = now

      const latest = buffer.latestBands
      if (!latest) return
      setHasData(true)

      const raw = averageChannels(latest.abs)
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
  }, [buffer])

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

      {!hasData && (
        <div className="pointer-events-none absolute right-3 top-2 z-10 font-bd-mono text-[9px] uppercase tracking-[0.2em] text-bd-cream/40">
          WAITING DSP
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
          // dB relative to the loudest band (always ≤ 0).
          const db = 10 * (Math.log10(v + LOG_EPS) - peakLog)
          const frac = Math.min(1, Math.max(0.02, 1 + db / LOG_RANGE_DB))
          heightPct = Math.round(frac * 100)
          label = `${db <= -99 ? "−99" : db.toFixed(0)} dB`
        }

        return (
          <div key={name} className="flex flex-col items-stretch justify-end gap-1.5 min-h-0">
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
