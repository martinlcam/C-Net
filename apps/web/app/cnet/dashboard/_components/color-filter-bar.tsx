"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { VaultFile } from "@/lib/vault-api"
import { VAULT_COLORS } from "./format"

export function ColorFilterBar({
  files,
  selected,
  onSelect,
}: {
  files: VaultFile[]
  selected: string | null
  onSelect: (colorKey: string | null) => void
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const file of files) {
      if (file.color) map.set(file.color, (map.get(file.color) ?? 0) + 1)
    }
    return map
  }, [files])

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-neutral-60 text-xs uppercase tracking-wide">Filter</span>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-full border px-3 py-1 text-neutral-80 text-xs transition-colors",
          selected === null
            ? "border-neutral-80 bg-neutral-10 font-medium text-neutral-100"
            : "border-neutral-30 bg-white hover:border-neutral-50"
        )}
        aria-pressed={selected === null}
      >
        All
      </button>
      {VAULT_COLORS.map((color) => {
        const count = counts.get(color.key) ?? 0
        const active = selected === color.key
        return (
          <button
            key={color.key}
            type="button"
            disabled={count === 0}
            onClick={() => onSelect(active ? null : color.key)}
            title={`${color.label}${count > 0 ? ` (${count})` : ""}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? "border-neutral-80 bg-neutral-10 font-medium text-neutral-100"
                : "border-neutral-30 bg-white hover:border-neutral-50"
            )}
            aria-pressed={active}
            aria-label={`${color.label}, ${count} files`}
          >
            <span
              className={cn(
                "h-3.5 w-3.5 rounded-full",
                active && "ring-2 ring-neutral-90 ring-offset-1"
              )}
              style={{ backgroundColor: color.hex }}
            />
            <span className="text-neutral-80">{color.label}</span>
            {count > 0 ? <span className="text-neutral-60">({count})</span> : null}
          </button>
        )
      })}
    </div>
  )
}
