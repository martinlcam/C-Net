import type { ProxmoxVM } from "@cnet/engine"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

/** Power verbs the dashboard exposes, in the order they appear on a card. */
export type VMAction = "start" | "shutdown" | "reboot" | "stop"

export const ACTION_LABELS: Record<VMAction, string> = {
  start: "Start",
  shutdown: "Shutdown",
  reboot: "Restart",
  stop: "Force stop",
}

/** `reboot` and `stop` are the API's paths for these verbs; the rest match. */
const ACTION_PATHS: Record<VMAction, string> = {
  start: "start",
  shutdown: "shutdown",
  reboot: "restart",
  stop: "stop",
}

export async function fetchVMs(): Promise<ProxmoxVM[]> {
  const res = await fetch(`${API_BASE}/proxmox/vms`, { credentials: "include" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.message || body.error || `Failed to load guests (${res.status})`)
  }
  return body.data ?? []
}

export async function vmAction(vmid: number, action: VMAction): Promise<{ taskId: string }> {
  const res = await fetch(`${API_BASE}/proxmox/vms/${vmid}/${ACTION_PATHS[action]}`, {
    method: "POST",
    credentials: "include",
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.message || body.error || `Request failed (${res.status})`)
  }
  return body
}
