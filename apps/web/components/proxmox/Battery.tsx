"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { BatteryModel } from "./live"

const FILL: Record<BatteryModel["mode"], string> = {
  full: "fill-accent-green-60",
  charging: "fill-accent-green-60",
  draining: "fill-yellow-500",
  critical: "fill-accent-red-60",
  unknown: "fill-neutral-40",
}

/**
 * A battery glyph whose level is the charge. On mains below full it shows a charging
 * pulse rising through the cell; on battery the level drains and a small bolt marks it.
 * The caption next to it carries the exact numbers; this is the glance.
 */
export function Battery({ model }: { model: BatteryModel }) {
  const still = useReducedMotion()
  const w = 44
  const h = 22
  const inner = w - 6 // body minus the 2px wall and the 4px cap gap
  const level = (model.fill / 100) * inner
  const moving = !still && (model.mode === "charging" || model.mode === "draining")
  return (
    <svg
      width={w + 4}
      height={h}
      viewBox={`0 0 ${w + 4} ${h}`}
      role="img"
      aria-label={`Battery ${Math.round(model.fill)} percent, ${model.mode}`}
      className="shrink-0"
    >
      <rect
        x={1}
        y={1}
        width={w}
        height={h - 2}
        rx={4}
        className="fill-none stroke-neutral-40"
        strokeWidth={2}
      />
      <rect x={w + 1} y={h / 2 - 4} width={3} height={8} rx={1} className="fill-neutral-40" />
      <motion.rect
        x={3}
        y={3}
        height={h - 6}
        rx={2}
        className={FILL[model.mode]}
        initial={false}
        animate={{ width: Math.max(0, level) }}
        transition={still ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 18 }}
      />
      {moving ? (
        <motion.rect
          x={3}
          y={3}
          width={4}
          height={h - 6}
          className="fill-white/60"
          initial={{ x: model.mode === "charging" ? 3 : level }}
          animate={{
            x:
              model.mode === "charging" ? [3, Math.max(3, level - 4)] : [Math.max(3, level - 4), 3],
          }}
          transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      ) : null}
      {model.mode === "draining" || model.mode === "critical" ? (
        <path
          d={`M${w / 2 + 2} 4 L${w / 2 - 3} ${h / 2 + 1} h4 l-1 ${h / 2 - 5} 5 -${h / 2 - 1} h-4 z`}
          className="fill-neutral-100"
        />
      ) : null}
    </svg>
  )
}
