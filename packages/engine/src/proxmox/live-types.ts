/*
 * Live bay telemetry streamed by the host agent (cnet-bayd) over Redis →
 * apps/realtime WS → browser. Slow/identity data stays on the REST path
 * (storage-types.ts); this is only the fast-changing per-bay state.
 * See docs/ZFS_BAY_GUI_PLAN.md (Phase 2).
 */

export type SpinState = "active" | "standby" | "unknown"

export interface BayLiveState {
  serial: string
  /** Spun-up vs in standby (read without waking the drive). */
  spin: SpinState
  /** Had read/write IO since the last tick (the "blink"). */
  ioActive: boolean
  /** Locate LED currently being driven (Phase 3); false until then. */
  locate: boolean
}

export interface BayLiveFrame {
  /** Discriminator so apps/realtime can route it like bd frames. */
  t: "bay"
  ts: number
  bays: BayLiveState[]
  /** Present only while a pool is resilvering. */
  resilver?: { pool: string; percent: number }
}
