"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import type { VaultFile } from "@/lib/vault-api"
import { ColorFilterBar } from "./color-filter-bar"
import { FileGrid } from "./file-grid"
import { VAULT_COLORS } from "./format"
import { useFileViewMode } from "./use-file-view-mode"
import { useVaultFileActions } from "./use-vault-file-actions"
import { ViewModeToggle } from "./view-mode-toggle"

/** A read-only listing (starred/colored) with the standard per-file actions. */
export function FileView({
  title,
  queryKey,
  fetcher,
  empty,
  colorFilter = false,
}: {
  title: string
  queryKey: string
  fetcher: () => Promise<{ files: VaultFile[] }>
  empty: string
  /** When true, show color chips above the grid to filter by tag color. */
  colorFilter?: boolean
}) {
  const [viewMode, setViewMode] = useFileViewMode()
  const [colorKey, setColorKey] = useState<string | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ["vault", queryKey], queryFn: fetcher })
  const fileActions = useVaultFileActions()

  const allFiles = data?.files ?? []
  const files = useMemo(
    () => (colorKey ? allFiles.filter((f) => f.color === colorKey) : allFiles),
    [allFiles, colorKey]
  )
  const filteredEmpty =
    colorKey != null
      ? `No ${VAULT_COLORS.find((c) => c.key === colorKey)?.label.toLowerCase() ?? colorKey} files`
      : empty

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-bold text-2xl text-neutral-100 md:text-3xl">{title}</h1>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>
      {error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          {error instanceof Error ? error.message : "Something went wrong"}
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-neutral-60">Loading…</div>
      ) : (
        <>
          {colorFilter ? (
            <ColorFilterBar files={allFiles} selected={colorKey} onSelect={setColorKey} />
          ) : null}
          <FileGrid
            files={files}
            fileActions={fileActions}
            empty={filteredEmpty}
            viewMode={viewMode}
          />
        </>
      )}
    </div>
  )
}
