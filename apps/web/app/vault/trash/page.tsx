"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { File as FileIcon, RotateCcw, Trash2 } from "lucide-react"
import { getTrash, purgeFile, restoreFile } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

export default function TrashPage() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ["vault", "trash"], queryFn: getTrash })
  const invalidate = () => qc.invalidateQueries({ queryKey: ["vault", "trash"] })
  const restore = useMutation({ mutationFn: restoreFile, onSuccess: invalidate })
  const purge = useMutation({ mutationFn: purgeFile, onSuccess: invalidate })

  const files = data?.files ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 font-bold text-3xl text-neutral-100">Trash</h1>
      <p className="mb-4 text-neutral-70 text-sm">
        Deleted files are kept here until purged. Restoring returns them to their original folder.
      </p>

      {error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          {error instanceof Error ? error.message : "Something went wrong"}
        </div>
      ) : isLoading ? (
        <div className="py-12 text-center text-neutral-70">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-30 bg-white">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 border-neutral-20 border-b px-4 py-3 last:border-b-0 hover:bg-neutral-10"
            >
              <FileIcon className="h-5 w-5 text-neutral-70" />
              <span className="flex-1 truncate text-neutral-100">{f.filename}</span>
              <span className="w-20 text-right text-neutral-70 text-sm">{formatBytes(f.size)}</span>
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
          {files.length === 0 ? (
            <div className="py-12 text-center text-neutral-70">Trash is empty</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
