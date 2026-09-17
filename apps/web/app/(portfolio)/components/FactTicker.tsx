"use client"

import { useLayoutEffect, useRef, useState } from "react"
import type { Fact } from "@/app/api/facts/random/route"
import styles from "./FactTicker.module.css"

/* pixels per second, a touch quicker than the logo loop so a long fact does
   not outstay its welcome */
const SPEED = 140
const REDUCED_MOTION_MS = 8000

type Props = {
  fact: Fact
  onDone: () => void
}

/*
 * Runs a fact once across the ticker's strip, right to left, then hands the
 * strip back. Readers who prefer less motion see it still for a few seconds
 * instead.
 */
export function FactTicker({ fact, onDone }: Props) {
  const text = useRef<HTMLSpanElement>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [still, setStill] = useState(false)

  useLayoutEffect(() => {
    const el = text.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true)
      const timer = window.setTimeout(onDone, REDUCED_MOTION_MS)
      return () => window.clearTimeout(timer)
    }
    const strip = el.parentElement?.clientWidth ?? 0
    setDuration((el.scrollWidth + strip) / SPEED)
  }, [onDone])

  return (
    <div className={styles.strip} aria-live="polite">
      <span
        ref={text}
        className={`${styles.text} ${still ? styles.still : ""} ${duration === null ? "" : styles.running}`}
        style={duration === null ? undefined : { animationDuration: `${duration}s` }}
        onAnimationEnd={onDone}
      >
        <span className={styles.tag}>Fact</span>
        {fact.text}
        {fact.source && <span className={styles.source}> — {fact.source}</span>}
      </span>
    </div>
  )
}
