"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  BdBands,
  BdConnectionState,
  BdFrame,
  BdSampleFrame,
  BdStatusFrame,
  EegSample,
  Ppg3,
  Vec3,
} from "./bd-types"

/**
 * Ring buffer holding the most recent N samples per channel set. Components
 * read from this directly (it's the same Float64Array-of-arrays each render)
 * and animate via requestAnimationFrame off the head/tail indices, so React
 * never has to re-render at 256 Hz.
 */
export type BdRingBuffer = {
  eeg: { samples: EegSample[]; head: number; cap: number; pushed: number }
  ppg: { samples: Ppg3[]; head: number; cap: number; pushed: number }
  acc: { samples: Vec3[]; head: number; cap: number; pushed: number }
  gyro: { samples: Vec3[]; head: number; cap: number; pushed: number }
  /** Latest server-computed absolute band powers (BrainFlow), or null until the
   *  first `bands` frame arrives. Mutated in place like the rings — consumers
   *  read it off their own rAF loop, no React re-render per update. */
  latestBands: BdBands | null
}

const EEG_CAP = 256 * 8 // 8 seconds of EEG
const PPG_CAP = 64 * 12 // 12 seconds of PPG
const IMU_CAP = 52 * 12 // 12 seconds of IMU

function makeBuffer(): BdRingBuffer {
  return {
    eeg: { samples: new Array(EEG_CAP).fill([0, 0, 0, 0]), head: 0, cap: EEG_CAP, pushed: 0 },
    ppg: { samples: new Array(PPG_CAP).fill([0, 0, 0]), head: 0, cap: PPG_CAP, pushed: 0 },
    acc: { samples: new Array(IMU_CAP).fill([0, 0, 0]), head: 0, cap: IMU_CAP, pushed: 0 },
    gyro: { samples: new Array(IMU_CAP).fill([0, 0, 0]), head: 0, cap: IMU_CAP, pushed: 0 },
    latestBands: null,
  }
}

function pushInto<T>(buf: BdRingBuffer["eeg"] | BdRingBuffer["ppg"], items: T[]) {
  for (let i = 0; i < items.length; i++) {
    buf.samples[buf.head] = items[i] as never
    buf.head = (buf.head + 1) % buf.cap
    buf.pushed++
  }
}

function ingestSample(buf: BdRingBuffer, frame: BdSampleFrame) {
  if (frame.eeg?.length) pushInto(buf.eeg, frame.eeg)
  if (frame.ppg?.length) pushInto(buf.ppg, frame.ppg)
  if (frame.acc?.length) pushInto(buf.acc, frame.acc)
  if (frame.gyro?.length) pushInto(buf.gyro, frame.gyro)
}

const DEFAULT_STATUS: BdStatusFrame = {
  t: "status",
  ts: 0,
  connected: false,
  note: "WAITING FOR BRIDGE",
}

export type BdStreamApi = {
  connection: BdConnectionState
  status: BdStatusFrame
  buffer: BdRingBuffer
  /** Monotonically increasing counter; bump triggers consumers to redraw. */
  tick: number
  /** WS url actually in use. */
  source: string
}

export function useBdStream(): BdStreamApi {
  const buffer = useMemo(makeBuffer, [])
  const [connection, setConnection] = useState<BdConnectionState>("idle")
  const [status, setStatus] = useState<BdStatusFrame>(DEFAULT_STATUS)
  const [tick, setTick] = useState(0)
  const sourceRef = useRef<string>("")

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL
    let cancelled = false

    if (!wsUrl) {
      sourceRef.current = "—"
      setConnection("closed")
      setStatus({
        t: "status",
        ts: Date.now(),
        connected: false,
        note: "NO WS URL CONFIGURED",
      })
      return
    }

    // --- Live WS path: connect, ingest, auto-reconnect.
    sourceRef.current = `${wsUrl}/bd/live`
    let ws: WebSocket | null = null
    let reconnectAttempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let renderId: ReturnType<typeof setInterval> | null = null

    const open = () => {
      if (cancelled) return
      setConnection(reconnectAttempt === 0 ? "connecting" : "reconnecting")
      try {
        ws = new WebSocket(`${wsUrl}/bd/live`)
      } catch {
        scheduleReconnect()
        return
      }
      ws.onopen = () => {
        if (cancelled) return
        reconnectAttempt = 0
        setConnection("open")
      }
      ws.onmessage = (ev) => {
        if (cancelled) return
        let frame: BdFrame
        try {
          frame = JSON.parse(typeof ev.data === "string" ? ev.data : "") as BdFrame
        } catch {
          return
        }
        if (frame.t === "sample") {
          ingestSample(buffer, frame)
        } else if (frame.t === "bands") {
          // Stash in place — BandPowerBars reads it off its own rAF loop.
          buffer.latestBands = { ts: frame.ts, abs: frame.abs }
        } else if (frame.t === "status") {
          setStatus(frame)
        }
      }
      ws.onclose = () => {
        if (cancelled) return
        setStatus((s) => ({ ...s, connected: false, note: "BRIDGE LINK DOWN" }))
        scheduleReconnect()
      }
      ws.onerror = () => {
        // onclose will fire after this.
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      reconnectAttempt++
      const delay = Math.min(15_000, 500 * 2 ** Math.min(reconnectAttempt, 5))
      setConnection("reconnecting")
      reconnectTimer = setTimeout(open, delay)
    }

    renderId = setInterval(() => {
      if (cancelled) return
      setTick((n) => (n + 1) & 0xffff)
    }, 33)

    open()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (renderId) clearInterval(renderId)
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
        ws.close()
      }
      setConnection("closed")
    }
  }, [buffer])

  return { connection, status, buffer, tick, source: sourceRef.current }
}

/**
 * Read the last `n` samples from a ring-buffer slot, in chronological order.
 * Allocates a fresh array each call — fine for a 30 fps draw loop, NOT for
 * 256 Hz hot paths (canvas components iterate the ring in place instead).
 */
export function tail<T>(
  ring: { samples: T[]; head: number; cap: number; pushed: number },
  n: number
): T[] {
  const count = Math.min(n, ring.cap, ring.pushed)
  const out: T[] = new Array(count)
  for (let i = 0; i < count; i++) {
    const idx = (ring.head - count + i + ring.cap) % ring.cap
    out[i] = ring.samples[idx]
  }
  return out
}
