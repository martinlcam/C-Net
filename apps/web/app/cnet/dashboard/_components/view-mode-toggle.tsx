"use client"

import { Check, LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

export type FileViewMode = "grid" | "list"

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: FileViewMode
  onChange: (mode: FileViewMode) => void
}) {
  return (
    <fieldset
      className="inline-flex overflow-hidden rounded-full border border-neutral-30 bg-white p-0"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-neutral-80 transition-colors",
          value === "list" ? "bg-sky-100" : "hover:bg-neutral-10"
        )}
        aria-pressed={value === "list"}
        title="List view"
      >
        {value === "list" ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
        <List className="h-4 w-4" aria-hidden />
      </button>
      <div className="w-px self-stretch bg-neutral-30" aria-hidden />
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-neutral-80 transition-colors",
          value === "grid" ? "bg-sky-100" : "hover:bg-neutral-10"
        )}
        aria-pressed={value === "grid"}
        title="Grid view"
      >
        {value === "grid" ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </button>
    </fieldset>
  )
}

const STORAGE_KEY = "cnet.files.viewMode"

export function readFileViewMode(): FileViewMode {
  if (typeof window === "undefined") return "grid"
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "list" ? "list" : "grid"
}

export function persistFileViewMode(mode: FileViewMode) {
  localStorage.setItem(STORAGE_KEY, mode)
}
