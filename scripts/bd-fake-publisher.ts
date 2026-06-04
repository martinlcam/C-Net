/**
 * scripts/bd-fake-publisher.ts
 *
 * Stands in for `apps/neural-bridge` (the Python+bleak Muse reader) when the
 * Muse headband isn't paired yet. Connects to apps/realtime as a publisher
 * (`/bd/ingest?token=...`) and emits synthetic sample + status frames at the
 * same shape as the real bridge will.
 *
 * Run from the repo root:
 *
 *     bun run scripts/bd-fake-publisher.ts
 *
 * Env:
 *     NEXT_PUBLIC_REALTIME_WS_URL  (default ws://localhost:4002)
 *     BD_INGEST_KEY                (must match what realtime expects)
 *     BD_FAKE_BEATS_PER_MIN        (optional; default 72)
 */

// ------- copy of the wire-protocol types (no module deps so this script runs
// standalone without a package.json entry) -------

type EegSample = [number, number, number, number]
type Ppg3 = [number, number, number]
type Vec3 = [number, number, number]

type BdSampleFrame = {
  t: "sample"
  ts: number
  eeg?: EegSample[]
  ppg?: Ppg3[]
  acc?: Vec3[]
  gyro?: Vec3[]
}

type BdStatusFrame = {
  t: "status"
  ts: number
  connected: boolean
  deviceName?: string
  address?: string
  battery?: number | null
  hsi?: [number, number, number, number]
  rssi?: number | null
  note?: string
}

// ------- synth generator (mirrors apps/web/.../bd/lib/mock-stream.ts) -------

const EEG_RATE = 256
const PPG_RATE = 64
const IMU_RATE = 52
const BPM = Number(process.env.BD_FAKE_BEATS_PER_MIN || 72)
const HR_HZ = BPM / 60

function rnd(): number {
  return Math.random() * 2 - 1
}

function eegAt(c: number, t: number): number {
  const env = 0.5 + 0.5 * Math.sin(t * 0.07 + c * 1.2)
  return (
    5 * Math.sin(c) +
    12 * Math.sin(2 * Math.PI * 2.0 * t + c) +
    6 * Math.sin(2 * Math.PI * 6.0 * t + c * 0.4) +
    env * 18 * Math.sin(2 * Math.PI * 10.0 * t + c * 0.8) +
    4 * Math.sin(2 * Math.PI * 20.0 * t + c * 1.5) +
    2 * Math.sin(2 * Math.PI * 40.0 * t + c * 0.2) +
    8 * rnd()
  )
}

function ppgAt(c: number, t: number): number {
  const phase = (t * HR_HZ) % 1
  const beat = Math.exp(-Math.pow((phase - 0.1) / 0.06, 2))
  const base = 12000 + 600 * Math.sin(t * 0.3 + c)
  if (c === 1) return base + 1200 * beat + 30 * rnd()
  if (c === 2) return base + 200 * beat + 30 * rnd()
  return base + 30 * rnd()
}

function accAt(_c: number, t: number, a: 0 | 1 | 2): number {
  const sway = 0.03 * Math.sin(t * 1.3 + a * 0.7)
  return a === 2 ? 0.98 + sway : sway
}

function gyroAt(_c: number, t: number, a: 0 | 1 | 2): number {
  return 0.6 * Math.cos(t * 1.3 + a * 0.7)
}

const start = Date.now()
const emitted = { eeg: 0, ppg: 0, acc: 0, gyro: 0 }

function makeBatch(now: number): BdSampleFrame {
  const elapsedSec = (now - start) / 1000
  const targetEeg = Math.floor(elapsedSec * EEG_RATE)
  const targetPpg = Math.floor(elapsedSec * PPG_RATE)
  const targetAcc = Math.floor(elapsedSec * IMU_RATE)
  const targetGyro = Math.floor(elapsedSec * IMU_RATE)

  const eeg: EegSample[] = []
  for (let i = emitted.eeg; i < targetEeg; i++) {
    const t = i / EEG_RATE
    eeg.push([eegAt(0, t), eegAt(1, t), eegAt(2, t), eegAt(3, t)])
  }
  emitted.eeg = targetEeg

  const ppg: Ppg3[] = []
  for (let i = emitted.ppg; i < targetPpg; i++) {
    const t = i / PPG_RATE
    ppg.push([ppgAt(0, t), ppgAt(1, t), ppgAt(2, t)])
  }
  emitted.ppg = targetPpg

  const acc: Vec3[] = []
  for (let i = emitted.acc; i < targetAcc; i++) {
    const t = i / IMU_RATE
    acc.push([accAt(0, t, 0), accAt(0, t, 1), accAt(0, t, 2)])
  }
  emitted.acc = targetAcc

  const gyro: Vec3[] = []
  for (let i = emitted.gyro; i < targetGyro; i++) {
    const t = i / IMU_RATE
    gyro.push([gyroAt(0, t, 0), gyroAt(0, t, 1), gyroAt(0, t, 2)])
  }
  emitted.gyro = targetGyro

  return { t: "sample", ts: now, eeg, ppg, acc, gyro }
}

function makeStatus(now: number): BdStatusFrame {
  const drainMin = (now - start) / 60_000
  return {
    t: "status",
    ts: now,
    connected: true,
    deviceName: "Muse-FAKE",
    address: "00:00:00:00:00:00",
    battery: Math.max(12, Math.round(87 - drainMin * 0.4)),
    hsi: [1, 1, 1, 1],
    rssi: -56,
    note: "FAKE PUBLISHER",
  }
}

// ------- WS connection w/ reconnect -------

const wsBase = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:4002"
const token = process.env.BD_INGEST_KEY || "dev-insecure-key"
const url = `${wsBase}/bd/ingest?token=${encodeURIComponent(token)}`

let ws: WebSocket | null = null
let sampleTimer: ReturnType<typeof setInterval> | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null
let reconnectDelay = 500

function clearTimers() {
  if (sampleTimer) clearInterval(sampleTimer)
  if (statusTimer) clearInterval(statusTimer)
  sampleTimer = null
  statusTimer = null
}

function startEmitting() {
  clearTimers()
  // Send one status immediately so viewers flip out of "no signal".
  ws?.send(JSON.stringify(makeStatus(Date.now())))
  sampleTimer = setInterval(() => {
    if (!ws || ws.readyState !== 1) return
    ws.send(JSON.stringify(makeBatch(Date.now())))
  }, 100)
  statusTimer = setInterval(() => {
    if (!ws || ws.readyState !== 1) return
    ws.send(JSON.stringify(makeStatus(Date.now())))
  }, 1000)
}

function connect() {
  console.log(`[fake-publisher] connecting -> ${url}`)
  ws = new WebSocket(url)
  ws.onopen = () => {
    console.log("[fake-publisher] open — streaming synthetic frames")
    reconnectDelay = 500
    startEmitting()
  }
  ws.onclose = (ev) => {
    console.log(`[fake-publisher] closed (${ev.code}) — retry in ${reconnectDelay}ms`)
    clearTimers()
    setTimeout(connect, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, 10_000)
  }
  ws.onerror = (err) => {
    console.error("[fake-publisher] error:", (err as ErrorEvent).message || err)
  }
}

connect()

process.on("SIGINT", () => {
  console.log("[fake-publisher] SIGINT — closing")
  clearTimers()
  ws?.close()
  process.exit(0)
})
