"use client"

import { useEffect } from "react"

/**
 * Marks the body while any front-facing (portfolio) page is mounted so global
 * CSS can hide the window scrollbar there without affecting the app pages.
 * Mirrors the `data-bd` theme-swap pattern used by /bd.
 */
export function PortfolioChrome() {
  useEffect(() => {
    document.body.dataset.portfolio = "1"
    return () => {
      delete document.body.dataset.portfolio
    }
  }, [])

  return null
}
