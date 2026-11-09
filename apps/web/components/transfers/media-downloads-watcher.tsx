"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { getQueue, getTvQueue, type RequestStatus } from "@/lib/media-api"
import { type TransferItem, useTransferStore } from "@/lib/stores/transfers"

// Only things that are actually moving (or broke while moving) belong in the transfer panel;
// a title still waiting for its release or being searched for is shown in the Add dialog.
function toTransfers(source: string, items: RequestStatus[]): TransferItem[] {
  const out: TransferItem[] = []
  for (const q of items) {
    if (q.phase === "waiting" || q.phase === "searching") continue
    out.push({
      id: `${source}:${q.id}-${q.title}`,
      label: q.phase === "downloading" ? q.title : `${q.title} · ${q.label}`,
      kind: "download" as const,
      progress: q.progress ?? 0,
      status: q.phase === "failed" ? ("error" as const) : ("active" as const),
      error: q.phase === "failed" ? (q.detail ?? q.label) : undefined,
    })
  }
  return out
}

/**
 * Mounted once in the C-Net shell. Polls the Radarr/Sonarr download queues and
 * feeds active downloads into the shared transfer panel. Errors (media not yet
 * configured, etc.) are swallowed so nothing renders.
 */
export function MediaDownloadsWatcher() {
  const syncSource = useTransferStore((s) => s.syncSource)

  const movies = useQuery({
    queryKey: ["transfers", "radarr-queue"],
    queryFn: getQueue,
    refetchInterval: 5000,
    retry: false,
  })
  const tv = useQuery({
    queryKey: ["transfers", "sonarr-queue"],
    queryFn: getTvQueue,
    refetchInterval: 5000,
    retry: false,
  })

  useEffect(() => {
    if (movies.data) syncSource("radarr", toTransfers("radarr", movies.data.items))
  }, [movies.data, syncSource])
  useEffect(() => {
    if (tv.data) syncSource("sonarr", toTransfers("sonarr", tv.data.items))
  }, [tv.data, syncSource])

  return null
}
