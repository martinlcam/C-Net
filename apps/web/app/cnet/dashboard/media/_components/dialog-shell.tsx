"use client"

import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { backdropVariants, dialogVariants } from "./motion"
import { useEscapeKey } from "./use-escape-key"

/**
 * Backdrop + animated panel shared by the media dialogs. Escape and a click on the
 * backdrop both close it; render it inside an `AnimatePresence` to get the exit.
 */
export function DialogShell({
  label,
  onClose,
  escapeEnabled = true,
  backdropClassName,
  className,
  children,
}: {
  label: string
  onClose: () => void
  escapeEnabled?: boolean
  backdropClassName?: string
  className?: string
  children: ReactNode
}) {
  useEscapeKey(onClose, escapeEnabled)

  // Move focus into the dialog so Escape works without a click first, unless a child
  // (an autofocused search box, say) already claimed it.
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = panel.current
    if (el && !el.contains(document.activeElement)) el.focus()
  }, [])

  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn("fixed inset-0 z-50 flex justify-center bg-black/70", backdropClassName)}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        variants={dialogVariants}
        className={cn("outline-none", className)}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
