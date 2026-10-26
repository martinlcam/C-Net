"use client"

import { useEffect, useRef, useState } from "react"
import { appendFrame, diffGuestEvents, type GuestEvent, type LiveFrame } from "./live"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
/** Frames kept client-side: three minutes at the agent's 2 s cadence. */
const BUFFER = 90
const EVENTS = 8

export type HostLive = {
  /** Oldest first; the last entry is the newest frame. */
  frames: LiveFrame[]
  latest: LiveFrame | null
  events: GuestEvent[]
  connected: boolean
}

/**
 * Live host telemetry for the overview panel. Loads the agent's recent frames once so
 * charts are full on arrival, then subscribes to /host/live on the realtime service
 * (same superuser-only token as the bay stream). Pauses while the tab is hidden and
 * reconnects on drop; identity and storage stay on the REST overview.
 */
export function useHostLive(enabled: boolean): HostLive {
  const [state, setState] = useState<HostLive>({
    frames: [],
    latest: null,
    events: [],
    connected: false,
  })
  const framesRef = useRef<LiveFrame[]>([])
  const eventsRef = useRef<GuestEvent[]>([])

  useEffect(() => {
    if (!enabled) return
    const wsBase = process.env.NEXT_PUBLIC_REALTIME_WS_URL
    let ws: WebSocket | null = null
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined

    const push = (frame: LiveFrame) => {
      const prev = framesRef.current[framesRef.current.length - 1]
      const next = appendFrame(framesRef.current, frame, BUFFER)
      if (next === framesRef.current) return
      framesRef.current = next
      if (prev) {
        const fresh = diffGuestEvents(prev, frame)
        if (fresh.length > 0)
          eventsRef.current = [...fresh.reverse(), ...eventsRef.current].slice(0, EVENTS)
      }
      if (document.visibilityState === "hidden") return // keep the buffer, skip the render
      setState({ frames: next, latest: frame, events: eventsRef.current, connected: true })
    }

    async function loadHistory() {
      try {
        const res = await fetch(`${API_BASE}/proxmox/overview/history`, { credentials: "include" })
        if (!res.ok) return
        const frames = (await res.json()) as LiveFrame[]
        if (cancelled || !Array.isArray(frames)) return
        for (const f of frames) if (f?.t === "host") push(f)
      } catch {
        /* history is a nicety; live frames still arrive */
      }
    }

    async function connect() {
      if (!wsBase) return
      try {
        const res = await fetch(`${API_BASE}/proxmox/storage/live-token`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error("no live token")
        const { data } = (await res.json()) as { data: { token: string } }
        if (cancelled) return
        ws = new WebSocket(`${wsBase}/host/live?token=${encodeURIComponent(data.token)}`)
        ws.onmessage = (e) => {
          const f = JSON.parse(e.data as string) as LiveFrame & { t: string }
          if (f.t === "host") push(f)
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

    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const latest = framesRef.current[framesRef.current.length - 1] ?? null
      setState((s) => ({ ...s, frames: framesRef.current, latest, events: eventsRef.current }))
    }
    document.addEventListener("visibilitychange", onVisible)
    loadHistory().then(connect)
    return () => {
      cancelled = true
      clearTimeout(retry)
      ws?.close()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled])

  return state
}
