import { create } from "zustand"

export type TransferKind = "upload" | "download"
export type TransferStatus = "active" | "completed" | "error"

export interface TransferItem {
  id: string
  label: string
  kind: TransferKind
  progress: number // 0–100
  status: TransferStatus
  error?: string
}

interface TransferStore {
  items: Record<string, TransferItem>
  minimized: boolean
  hidden: boolean

  /** Add or replace a single transfer (used by uploads). */
  upsert: (item: TransferItem) => void
  /** Patch a single transfer by id. */
  update: (id: string, patch: Partial<TransferItem>) => void
  remove: (id: string) => void
  /**
   * Replace every item whose id starts with `${source}:` with the given set.
   * Used by the polled download queues so finished/removed downloads drop off.
   */
  syncSource: (source: string, items: TransferItem[]) => void
  /** Drop completed + errored items (used by the auto-hide timer). */
  clearSettled: () => void

  setMinimized: (v: boolean) => void
  hide: () => void
  show: () => void
}

export const useTransferStore = create<TransferStore>((set) => ({
  items: {},
  minimized: false,
  hidden: false,

  upsert: (item) => set((s) => ({ items: { ...s.items, [item.id]: item }, hidden: false })),

  update: (id, patch) =>
    set((s) => {
      const cur = s.items[id]
      if (!cur) return s
      return { items: { ...s.items, [id]: { ...cur, ...patch } } }
    }),

  remove: (id) =>
    set((s) => {
      const next = { ...s.items }
      delete next[id]
      return { items: next }
    }),

  syncSource: (source, incoming) =>
    set((s) => {
      const prefix = `${source}:`
      const next: Record<string, TransferItem> = {}
      // keep items from other sources
      for (const [id, item] of Object.entries(s.items)) {
        if (!id.startsWith(prefix)) next[id] = item
      }
      for (const item of incoming) next[item.id] = item
      // surface the panel again if a new download appeared
      const hidden = incoming.length > 0 ? false : s.hidden
      return { items: next, hidden }
    }),

  clearSettled: () =>
    set((s) => {
      const next: Record<string, TransferItem> = {}
      for (const [id, item] of Object.entries(s.items)) {
        if (item.status === "active") next[id] = item
      }
      return { items: next }
    }),

  setMinimized: (v) => set({ minimized: v }),
  hide: () => set({ hidden: true }),
  show: () => set({ hidden: false }),
}))
