"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import {
  deleteFile,
  moveFile,
  renameFile,
  setFileColor,
  starFile,
  unstarFile,
  type VaultFile,
} from "@/lib/vault-api"
import type { BulkOp, FileActions } from "./file-actions"

async function apply(file: VaultFile, op: BulkOp): Promise<unknown> {
  switch (op.kind) {
    case "star":
      return op.starred === file.starred
        ? undefined
        : op.starred
          ? starFile(file.id)
          : unstarFile(file.id)
    case "color":
      return setFileColor(file.id, op.color)
    case "move":
      return file.directoryId === op.directoryId ? undefined : moveFile(file.id, op.directoryId)
    case "delete":
      return deleteFile(file.id)
  }
}

/**
 * The per-file and bulk actions every file listing offers. Each action refreshes the vault
 * queries once when it is done, so a bulk change over hundreds of files costs one refetch.
 */
export function useVaultFileActions(): FileActions {
  const qc = useQueryClient()
  return useMemo(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ["vault"] })
    const one = (p: Promise<unknown>) => {
      p.catch(() => {}).finally(refresh)
    }
    return {
      onStar: (f) => one(f.starred ? unstarFile(f.id) : starFile(f.id)),
      onRename: (f, name) => one(renameFile(f.id, name)),
      onDelete: (f) => one(deleteFile(f.id)),
      onColor: (f, color) => one(setFileColor(f.id, color)),
      onMove: (f, directoryId) => one(moveFile(f.id, directoryId)),
      onBulk: async (files, op) => {
        // A handful at a time: enough to be quick, few enough not to flood the API.
        const queue = [...files]
        const worker = async () => {
          for (let f = queue.shift(); f; f = queue.shift()) {
            try {
              await apply(f, op)
            } catch {}
          }
        }
        await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker))
        await refresh()
      },
    }
  }, [qc])
}
