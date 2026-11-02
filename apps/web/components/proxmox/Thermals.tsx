"use client"

import { motion, useReducedMotion } from "framer-motion"
import { fanSpeed, fanText, type Tone, tempTone } from "./display"
import type { LiveFan, LiveTemp } from "./live"
import { Num } from "./Num"

const FILL: Record<Tone, string> = {
  ok: "bg-primary-purple-60",
  warn: "bg-yellow-500",
  bad: "bg-accent-red-60",
  none: "bg-neutral-40",
}
const TEXT: Record<Tone, string> = {
  ok: "text-neutral-100",
  warn: "text-yellow-600",
  bad: "text-accent-red-70",
  none: "text-neutral-50",
}

/** A thermometer the height of a line of text: the column rises with the reading. */
export function TempChip({ temp }: { temp: LiveTemp }) {
  const still = useReducedMotion()
  const tone = tempTone(temp.c)
  const fill = Math.max(4, Math.min(100, temp.c))
  return (
    <div className="flex items-center gap-2" title={`${temp.label} ${temp.c.toFixed(1)} °C`}>
      <span className="flex h-6 w-1.5 items-end overflow-hidden rounded-full bg-neutral-20">
        <motion.span
          className={`block w-full rounded-full ${FILL[tone]}`}
          initial={false}
          animate={{ height: `${fill}%` }}
          transition={still ? { duration: 0 } : { type: "spring", stiffness: 80, damping: 20 }}
        />
      </span>
      <span className="leading-tight">
        <span className={`block text-sm ${TEXT[tone]}`}>
          <Num value={temp.c} digits={0} suffix="°" />
        </span>
        <span className="block text-neutral-50 text-xs">{temp.label}</span>
      </span>
    </div>
  )
}

/**
 * Three blades that turn at the fan's speed: a full-duty fan takes a quarter second per
 * turn, a barely-spinning one three seconds, a stopped one does not move.
 */
export function Fan({ fan }: { fan: LiveFan }) {
  const still = useReducedMotion()
  const speed = fanSpeed(fan)
  const spinning = speed > 0 && !still
  const duration = 0.25 + (1 - speed) * 2.75
  return (
    <div className="flex items-center gap-2" title={`${fan.label} ${fanText(fan)}`}>
      <svg width={22} height={22} viewBox="0 0 22 22" role="img" aria-label={fan.label}>
        <circle cx={11} cy={11} r={10} className="fill-none stroke-neutral-30" strokeWidth={1} />
        <motion.g
          style={{ originX: "11px", originY: "11px" }}
          animate={spinning ? { rotate: 360 } : { rotate: 0 }}
          transition={
            spinning
              ? { duration, repeat: Number.POSITIVE_INFINITY, ease: "linear" }
              : { duration: 0 }
          }
        >
          {[0, 120, 240].map((a) => (
            <path
              key={a}
              d="M11 11 C 8 7, 9 3, 11 3 C 13 3, 14 7, 11 11 Z"
              transform={`rotate(${a} 11 11)`}
              className={speed > 0 ? "fill-primary-purple-60" : "fill-neutral-40"}
            />
          ))}
        </motion.g>
        <circle cx={11} cy={11} r={1.6} className="fill-neutral-100" />
      </svg>
      <span className="leading-tight">
        <span className="block text-neutral-100 text-sm tabular-nums">{fanText(fan)}</span>
        <span className="block text-neutral-50 text-xs">{fan.label}</span>
      </span>
    </div>
  )
}

/** Every temperature and fan the agent found, in one quiet row. */
export function Thermals({ temps, fans }: { temps: LiveTemp[]; fans: LiveFan[] }) {
  if (temps.length === 0 && fans.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {temps.map((t) => (
        <TempChip key={t.label} temp={t} />
      ))}
      {fans.map((f) => (
        <Fan key={f.label} fan={f} />
      ))}
    </div>
  )
}
