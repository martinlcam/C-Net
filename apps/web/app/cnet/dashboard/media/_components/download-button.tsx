"use client"

import { Check, Download, Loader2, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { downloadItem } from "@/lib/media-api"
import { cn } from "@/lib/utils"

type Phase = "idle" | "starting" | "started" | "failed"

// Browsers hold back a burst of downloads; a short gap lets each one register.
const GAP_MS = 700

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function PhaseIcon({ phase, className }: { phase: Phase; className?: string }) {
  if (phase === "starting") return <Loader2 className={cn("animate-spin", className)} />
  if (phase === "started") return <Check className={className} />
  if (phase === "failed") return <TriangleAlert className={className} />
  return <Download className={className} />
}

/**
 * Saves one item — or, given several ids, each in turn — through the browser's own
 * download manager. `label` names what is being saved for assistive tech; pass
 * `children` to show visible text next to the icon.
 */
export function DownloadButton({
  itemIds,
  label,
  className,
  children,
}: {
  itemIds: string[]
  label: string
  className?: string
  children?: React.ReactNode
}) {
  const [phase, setPhase] = useState<Phase>("idle")

  const start = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (phase === "starting" || itemIds.length === 0) return
    setPhase("starting")
    try {
      for (const [i, id] of itemIds.entries()) {
        if (i > 0) await wait(GAP_MS)
        await downloadItem(id)
      }
      setPhase("started")
    } catch {
      setPhase("failed")
    }
    setTimeout(() => setPhase("idle"), 2500)
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={phase === "starting" || itemIds.length === 0}
      aria-label={label}
      title={phase === "failed" ? "Couldn't start the download" : label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 transition-colors disabled:cursor-default",
        className
      )}
    >
      <PhaseIcon phase={phase} className="h-4 w-4 shrink-0" />
      {children}
    </button>
  )
}
