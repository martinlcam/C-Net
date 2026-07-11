"use client"

import { useEffect } from "react"

/**
 * Marks the body while any front-facing (portfolio) page is mounted so global
 * CSS can hide the window scrollbar there without affecting the app pages.
 * Mirrors the `data-bd` theme-swap pattern used by /bd.
 */
export function PortfolioChrome() {
  useEffect(() => {
    document.documentElement.classList.add("portfolio-no-scrollbar")
    return () => {
      document.documentElement.classList.remove("portfolio-no-scrollbar")
    }
  }, [])

  return null
}
