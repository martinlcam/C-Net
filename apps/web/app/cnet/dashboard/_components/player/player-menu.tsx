"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { popoverVariants, sheetVariants } from "../motion"

/**
 * A control-bar button with its menu: an anchored popover on the desk, a bottom sheet on
 * phones (an anchored popover would hang off the left edge of the screen). The region is
 * tagged `data-player-menu` so presses inside it never count as presses on the picture.
 */
export function PlayerMenu({
  open,
  onToggle,
  label,
  icon,
  active = false,
  mobile,
  panelClassName,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  icon: ReactNode
  active?: boolean
  mobile: boolean
  /** Desk-only sizing of the popover; phones always get the full-width sheet. */
  panelClassName?: string
  children: ReactNode
}) {
  return (
    <div className="relative" data-player-menu>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={`rounded p-1 hover:text-white/80 ${open || active ? "text-white" : ""}`}
      >
        {icon}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            variants={mobile ? sheetVariants : popoverVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: "bottom right" }}
            className={cn(
              "flex bg-neutral-900/95 text-sm shadow-xl ring-1 ring-white/15",
              mobile
                ? "fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
                : cn(
                    "absolute right-0 bottom-10 gap-2 rounded-md p-3",
                    panelClassName ?? "w-[30rem] max-w-[calc(100vw-1.5rem)]"
                  )
            )}
          >
            {mobile ? (
              <div
                aria-hidden
                className="-mt-2 mx-auto h-1 w-10 shrink-0 rounded-full bg-white/25"
              />
            ) : null}
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** A titled column of options inside a PlayerMenu. */
export function MenuSection({
  title,
  className,
  children,
  footer,
}: {
  title: string
  className?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <p className="mb-1 px-2 font-semibold text-white/50 text-xs uppercase">{title}</p>
      <div className="max-h-56 overflow-y-auto">{children}</div>
      {footer}
    </div>
  )
}

export function MenuOption({
  active,
  onSelect,
  children,
}: {
  active: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-white hover:bg-white/10"
    >
      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
      <span className="min-w-0 break-words">{children}</span>
    </button>
  )
}

/**
 * Clicking anywhere outside an open menu or panel dismisses it. Menu regions (and the
 * buttons that toggle them) carry `data-player-menu`; a Radix popover's content is
 * portalled to <body>, so it is recognised by its popper wrapper, and an open Radix
 * menu gets to dismiss itself first. The dismissing press is swallowed so it doesn't
 * also reach the picture and toggle playback.
 */
export function useDismissMenus(anyOpen: boolean, closeAll: () => void): void {
  const swallowClick = useRef(false)
  useEffect(() => {
    if (!anyOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target || target.closest("[data-player-menu], [data-radix-popper-content-wrapper]"))
        return
      if (document.querySelector("[data-radix-menu-content][data-state=open]")) return
      closeAll()
      swallowClick.current = true
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [anyOpen, closeAll])
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      e.stopPropagation()
      e.preventDefault()
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
}
