"use client"

import { animate, useMotionValue, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

/** A number that glides to its new value instead of jumping. */
export function Num({
  value,
  digits = 0,
  suffix = "",
}: {
  value: number
  digits?: number
  suffix?: string
}) {
  const still = useReducedMotion()
  const mv = useMotionValue(value)
  const [text, setText] = useState(() => value.toFixed(digits))
  useEffect(() => {
    if (still) {
      setText(value.toFixed(digits))
      return
    }
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setText(v.toFixed(digits)),
    })
    return () => controls.stop()
  }, [value, digits, still, mv])
  return (
    <span className="tabular-nums">
      {text}
      {suffix}
    </span>
  )
}
