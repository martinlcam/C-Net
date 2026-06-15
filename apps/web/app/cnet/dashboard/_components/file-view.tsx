"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  deleteFile,
  renameFile,
  setFileColor,
  starFile,
  unstarFile,
  type VaultFile,
} from "@/lib/vault-api"
import { ColorFilterBar } from "./color-filter-bar"
import { FileGrid } from "./file-grid"
import { VAULT_COLORS } from "./format"
import { useFileViewMode } from "./use-file-view-mode"
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
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useFileViewMode()
  const [colorKey, setColorKey] = useState<string | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ["vault", queryKey], queryFn: fetcher })
  const onSuccess = () => qc.invalidateQueries({ queryKey: ["vault"] })

  const star = useMutation({ mutationFn: starFile, onSuccess })
  const unstar = useMutation({ mutationFn: unstarFile, onSuccess })
  const removeF = useMutation({ mutationFn: deleteFile, onSuccess })
  const renameF = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFile(id, name),
    onSuccess,
  })
  const color = useMutation({
    mutationFn: ({ id, c }: { id: string; c: string | null }) => setFileColor(id, c),
    onSuccess,
  })

  const fileActions = {
    onStar: (f: VaultFile) => (f.starred ? unstar.mutate(f.id) : star.mutate(f.id)),
    onRename: (f: VaultFile, name: string) => renameF.mutate({ id: f.id, name }),
    onDelete: (f: VaultFile) => removeF.mutate(f.id),
    onColor: (f: VaultFile, c: string | null) => color.mutate({ id: f.id, c }),
  }

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
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-bold text-3xl text-neutral-100">{title}</h1>
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
