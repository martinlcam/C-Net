"use client"

import { useEffect, useRef, useState } from "react"
import { BD_CHANNELS, type EegSample } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

type Props = {
  buffer?: BdRingBuffer
  /** Device-provided HSI, if the headband sends it (Muse 2/S). The original
   *  2016 Muse does not, so we fall back to a signal-derived estimate. */
  hsi?: [number, number, number, number]
}

/**
 * Horseshoe-fit indicator. "HSI" = Horseshoe Indicator — Muse's name for the
 * per-electrode contact-quality reading, after the horseshoe shape of the band.
 * Quality is a small integer: 1 = good, 2 = ok, 4 = bad. The 2016 Muse doesn't
 * transmit it, so we derive it from each channel's standard deviation: a flat
 * channel (no contact) has ~0 spread; a railing/drifting one has a huge spread;
 * healthy EEG sits in between.
 */
const COLORS: Record<number, string> = {
  1: "#c6ff00", // good — lime
  2: "#f5d10c", // ok — amber
  4: "#ff3344", // bad — alarm
}

function color(q: number | undefined): string {
  if (q === undefined) return "rgba(250,246,241,0.20)"
  return COLORS[q] ?? COLORS[4]
}

const FIT_WINDOW = 512 // ~2 s @ 256 Hz — long enough for a steady fit estimate.

/** Map a channel's µV std-dev to a Muse-style 1/2/4 quality. */
function qualityFromStd(sd: number): number {
  if (sd < 2 || sd > 150) return 4 // flat/disconnected, or railing/heavy motion
  if (sd < 5 || sd > 60) return 2 // weak, or noisy/drifting
  return 1 // healthy EEG range
}

function computeStd(
  ring: BdRingBuffer["eeg"]
): [number, number, number, number] | undefined {
  const have = Math.min(FIT_WINDOW, ring.pushed)
  if (have < 64) return undefined
  const sum = [0, 0, 0, 0]
  const sumSq = [0, 0, 0, 0]
  for (let i = 0; i < have; i++) {
    const idx = (ring.head - have + i + ring.cap) % ring.cap
    const s = ring.samples[idx] as EegSample
    for (let c = 0; c < 4; c++) {
      const x = s[c]
      sum[c] += x
      sumSq[c] += x * x
    }
  }
  const std: [number, number, number, number] = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const mean = sum[c] / have
    std[c] = Math.sqrt(Math.max(0, sumSq[c] / have - mean * mean))
  }
  return std
}

const ELECTRODES = [
  { i: 0, label: "TP9", cx: 12, cy: 64 }, // left ear
  { i: 1, label: "AF7", cx: 34, cy: 18 }, // left forehead
  { i: 2, label: "AF8", cx: 66, cy: 18 }, // right forehead
  { i: 3, label: "TP10", cx: 88, cy: 64 }, // right ear
] as const

export function ContactQualityHud({ buffer, hsi: deviceHsi }: Props) {
  const [computed, setComputed] = useState<
    [number, number, number, number] | undefined
  >()
  // Smoothed std per channel (~3 s). Contact fit is a physical property, so a
  // brief head-turn shouldn't flip a dot to red — only *sustained* bad contact
  // (or a chronically flat channel) should move it.
  const smoothStd = useRef<[number, number, number, number] | null>(null)

  useEffect(() => {
    if (!buffer || deviceHsi) return
    let raf = 0
    let last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 300) return
      last = now
      const std = computeStd(buffer.eeg)
      if (!std) return
      const prev = smoothStd.current
      let sm: [number, number, number, number]
      if (!prev) {
        smoothStd.current = std
        sm = std
      } else {
        const A = 0.1 // ~3 s time constant at 300 ms updates
        for (let c = 0; c < 4; c++) prev[c] = prev[c] * (1 - A) + std[c] * A
        sm = prev
      }
      setComputed([
        qualityFromStd(sm[0]),
        qualityFromStd(sm[1]),
        qualityFromStd(sm[2]),
        qualityFromStd(sm[3]),
      ])
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [buffer, deviceHsi])

  const hsi = deviceHsi ?? computed

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between px-3 pt-3">
        <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/60">
          HSI.FIT
        </div>
        <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/40">
          {hsi ? (deviceHsi ? "LIVE" : "DERIVED") : "WAIT"}
        </div>
      </div>
      <div className="relative flex-1 px-4 pb-3">
        <svg
          viewBox="0 0 100 80"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 m-auto h-full w-full"
        >
          {/* Stylized head outline. */}
          <path
            d="M 50 8 Q 18 8 18 40 Q 18 70 50 72 Q 82 70 82 40 Q 82 8 50 8 Z"
            fill="none"
            stroke="rgba(250,246,241,0.20)"
            strokeWidth="0.8"
          />
          {/* Nose. */}
          <path
            d="M 47 8 L 50 2 L 53 8"
            fill="none"
            stroke="rgba(250,246,241,0.30)"
            strokeWidth="0.8"
          />
          {/* Electrode dots. */}
          {ELECTRODES.map((e) => {
            const q = hsi ? hsi[e.i] : undefined
            const fill = color(q)
            return (
              <g key={e.label}>
                <circle
                  cx={e.cx}
                  cy={e.cy}
                  r={4}
                  fill={fill}
                  stroke="rgba(13,13,15,0.8)"
                  strokeWidth={0.8}
                />
                <text
                  x={e.cx}
                  y={e.cy + (e.cy > 40 ? 12 : -6)}
                  textAnchor="middle"
                  fontSize="5"
                  fontFamily="var(--font-bd-mono), monospace"
                  fill="rgba(250,246,241,0.55)"
                >
                  {e.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="border-t border-bd-rule px-3 py-2 grid grid-cols-4 gap-1 font-bd-mono text-[10px] text-bd-cream/70 tabular-nums">
        {BD_CHANNELS.EEG.map((label, i) => {
          const q = hsi?.[i]
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5"
                style={{ background: color(q) }}
              />
              <span className="text-bd-cream/45">{label}</span>
              <span className="ml-auto">{q ?? "-"}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
