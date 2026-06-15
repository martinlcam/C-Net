"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { File as FileIcon, RotateCcw, Trash2 } from "lucide-react"
import { getTrash, purgeFile, restoreFile } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import { formatBytes } from "../_components/format"

export default function TrashPage() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ["vault", "trash"], queryFn: getTrash })
  const onSuccess = () => qc.invalidateQueries({ queryKey: ["vault"] })
  const restore = useMutation({ mutationFn: restoreFile, onSuccess })
  const purge = useMutation({ mutationFn: purgeFile, onSuccess })

  const files = data?.files ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 font-bold text-3xl text-neutral-100">Trash</h1>
      <p className="mb-6 text-neutral-60 text-sm">
        Deleted files are kept here until purged. Restoring returns them to their original folder.
      </p>

      {error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          {error instanceof Error ? error.message : "Something went wrong"}
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-neutral-60">Loading…</div>
      ) : files.length === 0 ? (
        <div className="py-16 text-center text-neutral-60">Trash is empty</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-30 bg-white px-4 py-3"
            >
              <FileIcon className="h-5 w-5 shrink-0 text-neutral-60" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-neutral-100 text-sm" title={f.filename}>
                  {f.filename}
                </div>
                <div className="text-neutral-50 text-xs">{formatBytes(f.size)}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => restore.mutate(f.id)}
                title="Restore"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => purge.mutate(f.id)}
                title="Delete forever"
              >
                <Trash2 className="h-4 w-4 text-accent-red-70" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
