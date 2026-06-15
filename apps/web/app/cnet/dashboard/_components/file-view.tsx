"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  deleteFile,
  renameFile,
  setFileColor,
  starFile,
  unstarFile,
  type VaultFile,
} from "@/lib/vault-api"
import { FileGrid } from "./file-grid"
import { useFileViewMode } from "./use-file-view-mode"
import { ViewModeToggle } from "./view-mode-toggle"

/** A read-only listing (starred/colored) with the standard per-file actions. */
export function FileView({
  title,
  queryKey,
  fetcher,
  empty,
}: {
  title: string
  queryKey: string
  fetcher: () => Promise<{ files: VaultFile[] }>
  empty: string
}) {
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useFileViewMode()
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
        <FileGrid
          files={data?.files ?? []}
          fileActions={fileActions}
          empty={empty}
          viewMode={viewMode}
        />
      )}
    </div>
  )
}
