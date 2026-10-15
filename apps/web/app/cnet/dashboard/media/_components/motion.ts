import type { Transition, Variants } from "framer-motion"

/** Snappy spring for things that move into place (tab pill, dialogs, the episode panel). */
export const spring: Transition = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 }

const easeOut: Transition["ease"] = [0.22, 1, 0.36, 1]

/** A row reveals itself, then its cards stagger in via `cardVariants`. */
export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOut } },
}

/**
 * Cards take their index as `custom` so the stagger is capped — a 60-title genre row
 * should not keep trickling in for two seconds after the visible part has settled.
 */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easeOut, delay: Math.min(i, 12) * 0.03 },
  }),
}

/** Tab and search swaps: the old view slips up and out, the new one rises in. */
export const viewVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14, ease: "easeIn" } },
}

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
}

export const dialogVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 380, damping: 32 } },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15, ease: "easeIn" } },
}

/** Small anchored menus (the player's settings popover). Set the transform origin on the element. */
export const popoverVariants: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.16, ease: easeOut } },
  exit: { opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12, ease: "easeIn" } },
}

export const panelVariants: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: spring },
  exit: { x: "100%", transition: { duration: 0.2, ease: "easeIn" } },
}
