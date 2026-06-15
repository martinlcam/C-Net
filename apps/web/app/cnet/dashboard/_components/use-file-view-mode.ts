"use client"

import { useEffect, useState } from "react"
import { type FileViewMode, persistFileViewMode, readFileViewMode } from "./view-mode-toggle"

export function useFileViewMode() {
  const [viewMode, setViewMode] = useState<FileViewMode>("grid")

  useEffect(() => {
    setViewMode(readFileViewMode())
  }, [])

  function updateViewMode(mode: FileViewMode) {
    setViewMode(mode)
    persistFileViewMode(mode)
  }

  return [viewMode, updateViewMode] as const
}
