"use client"

import { useSyncExternalStore } from "react"
import type { Fact } from "@/app/api/facts/random/route"

/*
 * The hero's target box asks for a fact and the masthead's ticker shows it:
 * they are in different sections, so this small store sits between them.
 * At most one fact runs at a time; a click while one is loading or
 * scrolling is ignored.
 */

type State = {
  fact: Fact | null
  loading: boolean
}

let state: State = { fact: null, loading: false }
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFactTicker() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  )
}

export async function requestFact() {
  if (state.loading || state.fact) return
  set({ fact: null, loading: true })
  try {
    const res = await fetch("/api/facts/random")
    if (!res.ok) throw new Error(`facts ${res.status}`)
    set({ fact: (await res.json()) as Fact, loading: false })
  } catch {
    set({
      fact: { text: "The fact machine is asleep. Try again in a moment.", source: "" },
      loading: false,
    })
  }
}

export function clearFact() {
  set({ fact: null, loading: false })
}
