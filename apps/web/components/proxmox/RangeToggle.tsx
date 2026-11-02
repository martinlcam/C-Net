"use client"

import { LayoutGroup, motion, useReducedMotion } from "framer-motion"

export type Range = "live" | "hour" | "day"

const LABELS: Record<Range, string> = { live: "3 min", hour: "1 h", day: "24 h" }
const ORDER: Range[] = ["live", "hour", "day"]

/** How far back the node charts look; the highlight slides to the chosen span. */
export function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const still = useReducedMotion()
  return (
    <LayoutGroup id="proxmox-range">
      <div className="flex rounded-full border border-neutral-30 p-0.5 text-xs">
        {ORDER.map((r) => {
          const active = r === value
          return (
            <button
              key={r}
              type="button"
              aria-pressed={active}
              aria-label={`Show the ${LABELS[r]} of history`}
              onClick={() => onChange(r)}
              className={`relative rounded-full px-2.5 py-0.5 tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-purple-60 ${active ? "text-white" : "text-neutral-70 hover:text-neutral-100"}`}
            >
              {active ? (
                <motion.span
                  layoutId="pill"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary-purple-60"
                  transition={
                    still ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 28 }
                  }
                />
              ) : null}
              <span className="relative">{LABELS[r]}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
