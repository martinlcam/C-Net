"use client"

import { useSyncExternalStore } from "react"
import type { Fact } from "@/app/api/facts/random/route"

/*
 * The hero's target box asks for a fact and the masthead's ticker streams
 * it: they are in different sections, so this small store sits between them.
 * Fetched facts wait in a queue until the ticker takes them, one at a time,
 * as the next thing to enter its stream. A few may wait at once; clicks
 * beyond that are ignored.
 */

const MAX_WAITING = 3

type State = {
  loading: number
  waiting: number
}

const queue: string[] = []
let state: State = { loading: 0, waiting: 0 }
const listeners = new Set<() => void>()

function set(loading: number) {
  state = { loading, waiting: queue.length }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const snapshot = () => state

export function useFactTicker() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export async function requestFact() {
  if (state.loading + queue.length >= MAX_WAITING) return
  set(state.loading + 1)
  try {
    const res = await fetch("/api/facts/random")
    if (!res.ok) throw new Error(`facts ${res.status}`)
    queue.push(((await res.json()) as Fact).text)
  } catch {
    queue.push("The fact machine is asleep. Try again in a moment.")
  }
  set(state.loading - 1)
}

/* the next waiting fact, if any; the ticker calls this as it spawns items */
export function takeFact() {
  const text = queue.shift()
  if (text !== undefined) set(state.loading)
  return text
}
