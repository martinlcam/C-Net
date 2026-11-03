import { useSyncExternalStore } from "react"

// Matches Tailwind's `sm` breakpoint from below, so JS-side layout choices agree with
// the `sm:` classes around them.
const QUERY = "(max-width: 639px)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
