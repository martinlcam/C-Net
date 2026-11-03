import type { Transition, Variants } from "framer-motion"
import { spring } from "../../_components/motion"

export {
  backdropVariants,
  dialogVariants,
  popoverVariants,
  sheetVariants,
  spring,
} from "../../_components/motion"

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

export const panelVariants: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: spring },
  exit: { x: "100%", transition: { duration: 0.2, ease: "easeIn" } },
}
