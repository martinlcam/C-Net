"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { getQueue, getTvQueue, type QueueItem } from "@/lib/media-api"
import { type TransferItem, useTransferStore } from "@/lib/stores/transfers"

function toTransfers(source: string, items: QueueItem[]): TransferItem[] {
  return items.map((q) => ({
    id: `${source}:${q.id}-${q.title}`,
    label: q.title,
    kind: "download" as const,
    progress: q.progress,
    status: "active" as const,
  }))
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
    if (movies.data) syncSource("radarr", toTransfers("radarr", movies.data))
  }, [movies.data, syncSource])
  useEffect(() => {
    if (tv.data) syncSource("sonarr", toTransfers("sonarr", tv.data))
  }, [tv.data, syncSource])

  return null
}
