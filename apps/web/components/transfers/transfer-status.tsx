"use client"

import { Check, ChevronUp, Download, Loader2, Minus, Upload, X } from "lucide-react"
import { useEffect } from "react"
import { useMediaViewStore } from "@/lib/stores/media-view"
import { type TransferItem, useTransferStore } from "@/lib/stores/transfers"

const AUTO_HIDE_MS = 30_000

function StatusIcon({ item }: { item: TransferItem }) {
  if (item.status === "completed") return <Check className="h-4 w-4 text-green-600" />
  if (item.status === "error") return <X className="h-4 w-4 text-red-600" />
  return <Loader2 className="h-4 w-4 animate-spin text-neutral-60" />
}

export function TransferStatus() {
  const items = useTransferStore((s) => s.items)
  const minimized = useTransferStore((s) => s.minimized)
  const hidden = useTransferStore((s) => s.hidden)
  // Hide the widget while a title is open for viewing; transfers keep running.
  const viewing = useMediaViewStore((s) => s.viewing)
  const setMinimized = useTransferStore((s) => s.setMinimized)
  const hide = useTransferStore((s) => s.hide)
  const clearSettled = useTransferStore((s) => s.clearSettled)

  const list = Object.values(items)
  const activeCount = list.filter((i) => i.status === "active").length

  // Auto-hide: once nothing is active, clear settled items after a delay.
  useEffect(() => {
    if (list.length === 0 || activeCount > 0) return
    const t = setTimeout(() => clearSettled(), AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [list.length, activeCount, clearSettled])

  // Warn before leaving while transfers are active.
  useEffect(() => {
    if (activeCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [activeCount])

  if (list.length === 0 || hidden || viewing) return null

  const uploads = list.filter((i) => i.kind === "upload" && i.status === "active").length
  const downloads = list.filter((i) => i.kind === "download" && i.status === "active").length
  const overall = Math.round(
    list.reduce((sum, i) => sum + (i.status === "completed" ? 100 : i.progress), 0) / list.length
  )
  const anyError = list.some((i) => i.status === "error")

  let summary: string
  if (activeCount === 0)
    summary = anyError ? "Transfers finished (with errors)" : "All transfers done"
  else if (uploads && downloads) summary = `${activeCount} transfers`
  else if (uploads) summary = `${uploads} uploading`
  else summary = `${downloads} downloading`

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-white px-4 py-2 font-medium text-neutral-90 text-sm shadow-xl ring-1 ring-neutral-30"
      >
        {activeCount > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-neutral-60" />
        ) : (
          <Check className="h-4 w-4 text-green-600" />
        )}
        {summary}
        <ChevronUp className="h-4 w-4 text-neutral-60" />
      </button>
    )
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-w-[90vw] rounded-lg bg-white shadow-xl ring-1 ring-neutral-30">
      <div className="flex items-center justify-between border-neutral-10 border-b px-3 py-2">
        <span className="font-semibold text-neutral-90 text-sm">Transfers</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize"
            className="rounded p-1 hover:bg-neutral-10"
          >
            <Minus className="h-4 w-4 text-neutral-60" />
          </button>
          <button
            type="button"
            onClick={hide}
            aria-label="Close"
            className="rounded p-1 hover:bg-neutral-10"
          >
            <X className="h-4 w-4 text-neutral-60" />
          </button>
        </div>
      </div>

      <div className="px-3 pt-2">
        <p className="text-neutral-60 text-xs">{summary}</p>
        <div className="mt-1 h-1 overflow-hidden rounded bg-neutral-10">
          <div
            className={`h-full ${anyError ? "bg-red-600" : "bg-neutral-90"}`}
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>

      <ul className="max-h-48 space-y-1 overflow-y-auto p-2">
        {list.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {item.kind === "upload" ? (
              <Upload className="h-3.5 w-3.5 shrink-0 text-neutral-60" />
            ) : (
              <Download className="h-3.5 w-3.5 shrink-0 text-neutral-60" />
            )}
            <span className="min-w-0 flex-1 truncate text-neutral-90" title={item.label}>
              {item.label}
            </span>
            {item.status === "active" ? (
              <span className="shrink-0 text-neutral-60 text-xs">{item.progress}%</span>
            ) : null}
            <StatusIcon item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}
