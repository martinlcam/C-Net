"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Folder, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { listDir } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/stories/dialog/dialog"

/** Browse the vault's folders and pick one; `onPick(null)` means the root. */
export function FolderPickerDialog({
  open,
  title,
  confirmLabel,
  startIn = null,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  confirmLabel: string
  /** Folder to open with, usually the one being viewed. */
  startIn?: string | null
  onPick: (directoryId: string | null) => void
  onClose: () => void
}) {
  const [dirId, setDirId] = useState<string | null>(startIn)
  useEffect(() => {
    if (open) setDirId(startIn)
  }, [open, startIn])

  const listing = useQuery({
    queryKey: ["vault", "dir", dirId],
    queryFn: () => listDir(dirId),
    enabled: open,
  })
  const crumbs = listing.data?.breadcrumbs ?? []
  const here = crumbs[crumbs.length - 1]?.label ?? "My Vault"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-neutral-70 text-sm">
          {crumbs.map((b, i) => (
            <span key={b.directoryId ?? "root"} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                onClick={() => setDirId(b.directoryId)}
                className="py-1 hover:text-neutral-100 hover:underline"
              >
                {b.label}
              </button>
            </span>
          ))}
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-30">
          {listing.isPending ? (
            <div className="flex items-center justify-center py-8 text-neutral-60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : listing.data && listing.data.directories.length > 0 ? (
            listing.data.directories.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirId(d.id)}
                className="flex w-full items-center gap-2 border-neutral-10 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-10"
              >
                <Folder className="h-4 w-4 shrink-0 text-neutral-70" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-50" />
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-neutral-60 text-sm">No folders in here</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onPick(dirId)}>
            {confirmLabel} “{here}”
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
