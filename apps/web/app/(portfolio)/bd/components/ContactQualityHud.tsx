import { BD_CHANNELS } from "../lib/bd-types"

type Props = {
  hsi?: [number, number, number, number]
}

/**
 * Horseshoe-fit indicator. The Muse exposes per-electrode quality as a small
 * integer: 1 = good, 2 = ok, 4 = bad. We render the four electrodes as labeled
 * dots in their physical position around the head (TP9 / AF7 / AF8 / TP10).
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

/**
 * Indices (top-down view of a head):
 *   AF7  AF8
 *    \ __ /
 *   TP9    TP10
 */
const ELECTRODES = [
  { i: 0, label: "TP9", cx: 12, cy: 64 }, // left ear
  { i: 1, label: "AF7", cx: 34, cy: 18 }, // left forehead
  { i: 2, label: "AF8", cx: 66, cy: 18 }, // right forehead
  { i: 3, label: "TP10", cx: 88, cy: 64 }, // right ear
] as const

export function ContactQualityHud({ hsi }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between px-3 pt-3">
        <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/60">
          HSI.FIT
        </div>
        <div className="font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/40">
          {hsi ? "LIVE" : "WAIT"}
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
