import type { BayInfo, BayLiveState, PoolStatus } from "@cnet/engine"

export type BayTone =
  | "empty"
  | "offline"
  | "ok"
  | "warn"
  | "fault"
  | "resilver"
  | "locate"
  | "standby"

export interface BayStatus {
  tone: BayTone
  label: string
}

/**
 * Derive a single display status for a bay from its identity, ZFS vdev state,
 * the owning pool's scan state, and live spin/locate. Pending-sector / temperature
 * warnings come from per-drive SMART (shown in the drive detail), not here.
 */
export function deriveBayStatus(bay: BayInfo, pool?: PoolStatus, live?: BayLiveState): BayStatus {
  if (live?.locate) return { tone: "locate", label: "Locating" }
  if (!bay.occupied) return { tone: "empty", label: "Empty" }
  if (bay.offline) return { tone: "offline", label: "Offline · no link" }

  const z = bay.zfsState
  if (bay.smartHealth === "FAILED" || z === "FAULTED" || z === "DEGRADED" || z === "UNAVAIL") {
    return { tone: "fault", label: z ?? "SMART failed" }
  }
  if (pool?.scan.inProgress && pool.scan.kind === "resilver") {
    return { tone: "resilver", label: "Resilvering" }
  }
  // Spun down (parked) — healthy but idle. Shown yellow.
  if (live?.spin === "standby") return { tone: "standby", label: "Standby (spun down)" }

  const errs =
    (bay.zfsErrors?.read ?? 0) + (bay.zfsErrors?.write ?? 0) + (bay.zfsErrors?.cksum ?? 0)
  if (errs > 0) return { tone: "warn", label: "ZFS errors" }

  return { tone: "ok", label: z ?? "Online" }
}

export const TONE_STYLES: Record<BayTone, { caddie: string; led: string; text: string }> = {
  empty: {
    caddie: "border-neutral-80 bg-neutral-100/40 border-dashed",
    led: "bg-neutral-70",
    text: "text-neutral-60",
  },
  offline: {
    caddie: "border-amber-600/70 bg-amber-950/30",
    led: "bg-amber-500 animate-pulse",
    text: "text-amber-300",
  },
  ok: {
    caddie: "border-accent-green-70/60 bg-accent-green-100/20",
    led: "bg-accent-green-50",
    text: "text-accent-green-40",
  },
  warn: {
    caddie: "border-amber-500/70 bg-amber-950/30",
    led: "bg-amber-400 animate-pulse",
    text: "text-amber-300",
  },
  fault: {
    caddie: "border-accent-red-60 bg-accent-red-100/30",
    led: "bg-accent-red-60 animate-pulse",
    text: "text-accent-red-40",
  },
  resilver: {
    caddie: "border-secondary-blue-60 bg-secondary-blue-100/30",
    led: "bg-secondary-blue-50 animate-pulse",
    text: "text-secondary-blue-40",
  },
  // Spun down — yellow, calm (no pulse): it's healthy, just parked.
  standby: {
    caddie: "border-yellow-500/70 bg-yellow-950/30",
    led: "bg-yellow-400",
    text: "text-yellow-300",
  },
  // Hardware renders ledctl locate as a fast RED blink on this SGPIO backplane.
  locate: {
    caddie: "border-accent-red-50 bg-accent-red-90/40 ring-2 ring-accent-red-50",
    led: "bg-accent-red-50 animate-ping",
    text: "text-accent-red-30",
  },
}
