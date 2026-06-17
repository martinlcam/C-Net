"use client"

import type { BayLiveState } from "@cnet/engine"
import { useEffect, useState } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export interface BayLive {
  bySerial: Map<string, BayLiveState>
  resilver?: { pool: string; percent: number }
  connected: boolean
}

/**
 * Subscribes to the realtime /bay/live WS for per-bay blink/spin/resilver. The
 * key comes from the superuser-only /proxmox/storage/live-token endpoint, so a
 * non-admin browser can never open the stream. Reconnects on drop.
 */
export function useBayLive(): BayLive {
  const [state, setState] = useState<BayLive>({ bySerial: new Map(), connected: false })

  useEffect(() => {
    const wsBase = process.env.NEXT_PUBLIC_REALTIME_WS_URL
    if (!wsBase) return

    let ws: WebSocket | null = null
    let cancelled = false
    let retry: ReturnType<typeof setTimeout>

    async function connect() {
      try {
        const res = await fetch(`${API_BASE}/proxmox/storage/live-token`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error("no live token")
        const { data } = await res.json()
        if (cancelled) return

        ws = new WebSocket(`${wsBase}/bay/live?token=${encodeURIComponent(data.token)}`)
        ws.onmessage = (e) => {
          const f = JSON.parse(e.data as string)
          if (f.t !== "bay") return
          const m = new Map<string, BayLiveState>()
          for (const b of f.bays as BayLiveState[]) m.set(b.serial, b)
          setState({ bySerial: m, resilver: f.resilver, connected: true })
        }
        ws.onclose = () => {
          setState((s) => ({ ...s, connected: false }))
          if (!cancelled) retry = setTimeout(connect, 3000)
        }
        ws.onerror = () => ws?.close()
      } catch {
        if (!cancelled) retry = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      cancelled = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [])

  return state
}
