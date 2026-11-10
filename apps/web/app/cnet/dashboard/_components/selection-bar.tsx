"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Download, FolderInput, Loader2, Palette, Star, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { VaultFile } from "@/lib/vault-api"
import type { BulkOp } from "./file-actions"
import { VAULT_COLORS } from "./format"
import { spring } from "./motion"

/**
 * Floats above the grid while files are selected: the count and the things that make sense
 * to do to many files at once. Delete asks once, inline, instead of a browser dialog.
 */
export function SelectionBar({
  files,
  busy,
  onBulk,
  onMove,
  onDownload,
  onClear,
}: {
  files: VaultFile[]
  busy: boolean
  onBulk: (op: BulkOp) => void
  onMove: () => void
  onDownload: () => void
  onClear: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [colors, setColors] = useState(false)
  const n = files.length
  const allStarred = n > 0 && files.every((f) => f.starred)

  useEffect(() => {
    if (n === 0) {
      setConfirmDelete(false)
      setColors(false)
    }
  }, [n])

  const item =
    "flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-white transition-colors hover:bg-white/15 disabled:opacity-50"

  return (
    <AnimatePresence>
      {n > 0 ? (
        <motion.div
          key="selection-bar"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0, transition: { duration: 0.15 } }}
          transition={spring}
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex flex-wrap items-center justify-center gap-1 rounded-xl bg-neutral-90 px-2 py-1.5 shadow-2xl ring-1 ring-black/20 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-6"
          role="toolbar"
          aria-label="Selected files"
        >
          <span className="px-2 font-medium text-sm text-white tabular-nums">{n} selected</span>
          {confirmDelete ? (
            <>
              <span className="px-1 text-sm text-white/80">
                Delete {n} file{n === 1 ? "" : "s"}?
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onBulk({ kind: "delete" })}
                className={`${item} bg-accent-red-60 hover:bg-accent-red-70`}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={item}>
                Keep
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={onDownload} className={item}>
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onBulk({ kind: "star", starred: !allStarred })}
                className={item}
              >
                <Star
                  className={`h-4 w-4 ${allStarred ? "fill-yellow-400 text-yellow-400" : ""}`}
                />
                {allStarred ? "Unstar" : "Star"}
              </button>
              <div className="relative">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setColors((c) => !c)}
                  aria-expanded={colors}
                  className={item}
                >
                  <Palette className="h-4 w-4" />
                  Color
                </button>
                {colors ? (
                  <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-neutral-90 p-2 shadow-xl ring-1 ring-black/20">
                    {VAULT_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => {
                          setColors(false)
                          onBulk({ kind: "color", color: c.key })
                        }}
                        className="h-6 w-6 rounded-full ring-offset-2 ring-offset-neutral-90 hover:ring-2 hover:ring-white"
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setColors(false)
                        onBulk({ kind: "color", color: null })
                      }}
                      className="h-6 rounded-full px-2 text-white/80 text-xs hover:bg-white/15"
                    >
                      None
                    </button>
                  </div>
                ) : null}
              </div>
              <button type="button" disabled={busy} onClick={onMove} className={item}>
                <FolderInput className="h-4 w-4" />
                Move to…
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                className={`${item} text-accent-red-30 hover:text-accent-red-10`}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            title="Clear selection (Esc)"
            className={`${item} px-2`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
