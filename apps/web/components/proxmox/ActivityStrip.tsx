"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { ActivityItem } from "./live"

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

/** The mark before each entry: a pulse while running, a square when it failed, a dot otherwise. */
function Mark({ state, still }: { state: ActivityItem["state"]; still: boolean }) {
  if (state === "running") {
    return (
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {!still ? (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-primary-purple-60"
            animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
          />
        ) : null}
        <span aria-hidden className="relative h-2 w-2 rounded-full bg-primary-purple-60" />
      </span>
    )
  }
  if (state === "failed") {
    return <span aria-hidden className="h-2 w-2 rounded-sm bg-accent-red-60" />
  }
  return (
    <span
      aria-hidden
      className={`h-2 w-2 rounded-full ${state === "ok" ? "bg-accent-green-60" : "bg-neutral-40"}`}
    />
  )
}

/** What the node has been doing, newest first, each entry sliding in as it arrives. */
export function ActivityStrip({ items, now }: { items: ActivityItem[]; now: number }) {
  const still = useReducedMotion()
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 px-6 pb-3 text-neutral-70 text-sm">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.key}
            layout={!still}
            initial={still ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 tabular-nums"
          >
            <Mark state={item.state} still={Boolean(still)} />
            <span className={item.state === "failed" ? "text-accent-red-70" : "text-neutral-100"}>
              {item.text}
            </span>
            <span className="text-neutral-50">
              {item.state === "running" ? "now" : ago(item.ts, now)}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
