"use client"

import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { backdropVariants, sheetVariants } from "./motion"

export type SheetAction = {
  key: string
  label: string
  icon?: ReactNode
  onSelect?: () => void
  /** A link row (download) instead of a button. */
  href?: string
  download?: string
  destructive?: boolean
}

/**
 * Phone form of an item menu: a sheet rising from the bottom edge with one tall row per
 * action, the way phone file managers do it. The anchored dropdown it replaces would hang
 * off a thumb and need pixel-precise taps.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  actions: SheetAction[]
  /** Extra controls under the rows (the colour swatches). */
  children?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (typeof document === "undefined") return null

  const row =
    "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-neutral-100 active:bg-neutral-10"

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div key="sheet" className="fixed inset-0 z-[60]">
          <motion.button
            type="button"
            aria-label="Close menu"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            role="menu"
            variants={sheetVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div aria-hidden className="mx-auto mt-1 mb-2 h-1 w-10 rounded-full bg-neutral-30" />
            <p className="truncate px-3 pb-2 font-medium text-neutral-70 text-sm">{title}</p>
            {actions.map((a) => {
              const inner = (
                <>
                  {a.icon ? <span className="shrink-0 text-neutral-70">{a.icon}</span> : null}
                  <span className={cn("min-w-0 truncate", a.destructive && "text-accent-red-70")}>
                    {a.label}
                  </span>
                </>
              )
              return a.href ? (
                <a
                  key={a.key}
                  role="menuitem"
                  href={a.href}
                  download={a.download}
                  onClick={onClose}
                  className={row}
                >
                  {inner}
                </a>
              ) : (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClose()
                    a.onSelect?.()
                  }}
                  className={row}
                >
                  {inner}
                </button>
              )
            })}
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
