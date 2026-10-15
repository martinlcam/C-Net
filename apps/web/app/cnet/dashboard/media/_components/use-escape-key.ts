import { useEffect } from "react"

/**
 * Close on Escape. `enabled` lets a dialog stand down while another one is stacked on
 * top of it (the series modal under the player), so one keypress closes only the top.
 * A default-prevented Escape was already consumed by a popover inside the dialog.
 */
export function useEscapeKey(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, enabled])
}
