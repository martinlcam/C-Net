/**
 * Wire protocol for the Braindance stream.
 *
 * Bridge (Python, bleak)
 *   -> Redis PUBLISH bd:samples / bd:status (JSON strings)
 *   -> apps/realtime (Bun, subscribes to Redis, fans out to WS clients)
 *   -> apps/web /bd (this hook, decodes frames into a ring buffer)
 *
 * Sample-rate reference (Muse 2):
 *   EEG  4ch @ 256 Hz   (TP9, AF7, AF8, TP10)
 *   PPG  3ch @  64 Hz   (ambient, infrared, red)
 *   ACC  3ch @  52 Hz   (x, y, z, in g)
 *   GYRO 3ch @  52 Hz   (x, y, z, in degrees/sec)
 *
 * The bridge batches samples into ~10 Hz frames so each WS message carries
 * ~25 EEG samples plus a few PPG/IMU samples. Channels are independently
 * optional — older firmware / muse-classic may not emit PPG, etc.
 */

export const BD_CHANNELS = {
  EEG: ["TP9", "AF7", "AF8", "TP10"] as const,
  PPG: ["AMB", "IR", "RED"] as const,
  ACC: ["X", "Y", "Z"] as const,
  GYRO: ["X", "Y", "Z"] as const,
} as const

export type EegSample = [number, number, number, number]
export type Ppg3 = [number, number, number]
export type Vec3 = [number, number, number]

export type BdSampleFrame = {
  t: "sample"
  ts: number // ms since epoch on the bridge clock
  eeg?: EegSample[]
  ppg?: Ppg3[]
  acc?: Vec3[]
  gyro?: Vec3[]
}

export type BdStatusFrame = {
  t: "status"
  ts: number
  connected: boolean
  deviceName?: string
  address?: string
  /** 0..100, may be null if not yet received from the headband. */
  battery?: number | null
  /** Horseshoe Indicator — per-electrode signal quality. 1 = good, 2 = ok, 4 = bad. */
  hsi?: [number, number, number, number]
  /** dBm signal strength of the BLE link. */
  rssi?: number | null
  /** Optional human-readable note ("scanning", "muse busy", etc.). */
  note?: string
}

export type BdHelloFrame = {
  t: "hello"
  ts: number
  serverStartTs: number
  viewerCount: number
}

/**
 * Band powers computed server-side by the bridge (BrainFlow). These are
 * ABSOLUTE per-channel powers — `abs[channel] = [delta, theta, alpha, beta,
 * gamma]` — so the UI can derive relative %, log dB, or per-channel views from
 * the same numbers. Order matches BD_CHANNELS.EEG (TP9, AF7, AF8, TP10).
 */
export type BdBandsFrame = {
  t: "bands"
  ts: number
  /** EEG sample rate the powers were computed at (Hz). */
  rate: number
  abs: number[][]
}

/** Latest band powers stashed on the ring buffer for the band-power component. */
export type BdBands = { ts: number; abs: number[][] }

/** Frequency band order in every `abs` row. */
export const BD_BANDS = ["DELTA", "THETA", "ALPHA", "BETA", "GAMMA"] as const

export type BdFrame = BdSampleFrame | BdStatusFrame | BdHelloFrame | BdBandsFrame

export type BdConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "closed"
