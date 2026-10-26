"use client"

import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion"
import { useEffect } from "react"
import { dialAngle } from "./live"

const R = 20
const CX = 24
const CY = 24

function point(deg: number, radius = R): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)]
}

function arc(from: number, to: number): string {
  const [x1, y1] = point(from)
  const [x2, y2] = point(to)
  const large = to - from > 180 ? 1 : 0
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/**
 * A 240° dial for UPS load in watts out of the unit's rating. The needle is sprung so a
 * change in load is seen as movement, not a jump. Ticks at 0, half and full. The needle
 * rotates through the SVG transform attribute, which rotates about the dial's centre on
 * every browser; CSS transforms on SVG children do not.
 */
export function LoadDial({ watts, nominal }: { watts: number | null; nominal: number }) {
  const still = useReducedMotion()
  const angle = dialAngle(watts, nominal)
  const sprung = useSpring(angle, { stiffness: 70, damping: 14 })
  useEffect(() => {
    if (still) sprung.jump(angle)
    else sprung.set(angle)
  }, [angle, still, sprung])
  const rotate = useTransform(sprung, (a) => `rotate(${a.toFixed(2)} ${CX} ${CY})`)
  const fraction = Math.max(0, Math.min(1, watts === null || nominal <= 0 ? 0 : watts / nominal))
  return (
    <svg
      width={48}
      height={44}
      viewBox="0 0 48 44"
      role="img"
      aria-label={watts === null ? "Load unknown" : `Load ${watts} watts of ${nominal}`}
      className="shrink-0"
    >
      <path
        d={arc(-120, 120)}
        className="fill-none stroke-neutral-30"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {fraction > 0 ? (
        <path
          d={arc(-120, -120 + fraction * 240)}
          className="fill-none stroke-primary-purple-60"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ) : null}
      {[-120, 0, 120].map((t) => {
        const [x, y] = point(t, R + 5)
        return <circle key={t} cx={x} cy={y} r={1} className="fill-neutral-40" />
      })}
      <motion.line
        x1={CX}
        y1={CY}
        x2={CX}
        y2={CY - R + 1}
        className="stroke-neutral-100"
        strokeWidth={2.5}
        strokeLinecap="round"
        transform={rotate}
      />
      <circle cx={CX} cy={CY} r={2.5} className="fill-neutral-100" />
    </svg>
  )
}
