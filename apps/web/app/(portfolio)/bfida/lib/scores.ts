import type { BoardKind } from "./boards"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export type ScoreEntry = {
  id: string
  firstName: string
  lastInitial: string
  boardKind: BoardKind
  pegsRemaining: number
  createdAt: string
}

/** A valid first name: 1-20 letters, nothing else. */
export const FIRST_NAME_RE = /^[A-Za-z]{1,20}$/
/** A valid last initial: exactly one letter. */
export const INITIAL_RE = /^[A-Za-z]$/

/** Strip everything but letters and cap at 20 — for the strict first-name input. */
export function sanitizeFirstName(raw: string): string {
  return raw.replace(/[^A-Za-z]/g, "").slice(0, 20)
}

/** Keep a single letter, upper-cased — for the strict last-initial input. */
export function sanitizeInitial(raw: string): string {
  return raw
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 1)
    .toUpperCase()
}

/** "jOHN" -> "John": first letter upper, rest lower (matches server normalization). */
export function normalizeFirstName(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

export async function fetchScores(board: BoardKind): Promise<ScoreEntry[]> {
  const res = await fetch(`${API_BASE}/bfida/scores?board=${board}`)
  if (!res.ok) throw new Error("Failed to load leaderboard")
  return (await res.json()) as ScoreEntry[]
}

export async function recordScore(input: {
  firstName: string
  lastInitial: string
  boardKind: BoardKind
  pegsRemaining: number
}): Promise<ScoreEntry> {
  const res = await fetch(`${API_BASE}/bfida/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? "Failed to save score")
  }
  return (await res.json()) as ScoreEntry
}
