"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { GuestEvent } from "./live"

function describe(e: GuestEvent): string {
  switch (e.kind) {
    case "status":
      return `${e.name || e.vmid} ${e.to === "running" ? "started" : e.to}`
    case "appeared":
      return `${e.name || e.vmid} appeared`
    case "gone":
      return `${e.name || e.vmid} disappeared`
  }
}

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

/** Recent guest changes, newest first, each sliding in as it happens. */
export function EventStrip({ events, now }: { events: GuestEvent[]; now: number }) {
  const still = useReducedMotion()
  if (events.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 px-6 pb-3 text-neutral-70 text-sm">
      <AnimatePresence initial={false}>
        {events.map((e) => (
          <motion.li
            key={`${e.vmid}-${e.ts}-${e.kind}`}
            initial={still ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="tabular-nums"
          >
            <span className="text-neutral-100">{describe(e)}</span>
            <span className="ml-2 text-neutral-50">{ago(e.ts, now)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
