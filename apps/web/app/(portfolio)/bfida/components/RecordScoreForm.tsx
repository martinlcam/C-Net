"use client"

import { type FormEvent, useState } from "react"
import { Button } from "@/stories/button/button"
import type { BoardKind } from "../lib/boards"
import {
  FIRST_NAME_RE,
  INITIAL_RE,
  recordScore,
  sanitizeFirstName,
  sanitizeInitial,
} from "../lib/scores"

type RecordScoreFormProps = {
  boardKind: BoardKind
  pegsRemaining: number
  onRecorded: () => void
}

type Status = "idle" | "saving" | "done" | "error"

export function RecordScoreForm({ boardKind, pegsRemaining, onRecorded }: RecordScoreFormProps) {
  const [firstName, setFirstName] = useState("")
  const [initial, setInitial] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  const valid = FIRST_NAME_RE.test(firstName) && INITIAL_RE.test(initial)
  const pegLabel = `${pegsRemaining} peg${pegsRemaining === 1 ? "" : "s"} left`

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || status === "saving") return
    setStatus("saving")
    setError(null)
    try {
      await recordScore({ firstName, lastInitial: initial, boardKind, pegsRemaining })
      setStatus("done")
      onRecorded()
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to save score")
    }
  }

  if (status === "done") {
    return (
      <div className="border border-[#bea9e9] bg-[#bea9e9]/20 p-4">
        <p className="text-sm font-semibold text-black">Added to the leaderboard.</p>
        <p className="text-xs text-gray-700 mt-1">{pegLabel} — nice.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-black p-5 bg-white rounded-[8px]">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
        Record your score — {pegLabel}
      </p>
      <div className="flex flex-col gap-3">
        <input
          value={firstName}
          onChange={(e) => setFirstName(sanitizeFirstName(e.target.value))}
          placeholder="First name"
          aria-label="First name (letters only)"
          autoComplete="off"
          inputMode="text"
          maxLength={20}
          className="border border-black rounded-[8px] px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#bea9e9]"
        />
        <input
          value={initial}
          onChange={(e) => setInitial(sanitizeInitial(e.target.value))}
          placeholder="Last initial"
          aria-label="Last initial (one letter)"
          autoComplete="off"
          inputMode="text"
          maxLength={1}
          className="border border-black rounded-[8px] px-3 py-2 text-sm text-black bg-white uppercase focus:outline-none focus:ring-2 focus:ring-[#bea9e9] w-20"
        />
        <Button
          type="submit"
          disabled={!valid || status === "saving"}
          className="w-full bg-black text-white hover:bg-gray-800 rounded-[8px] py-3 text-base font-medium h-auto disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Record score"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </form>
  )
}
