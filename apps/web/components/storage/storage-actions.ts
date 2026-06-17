const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export interface ActionResult {
  ok: boolean
  output?: string
}

/** POST a storage action (locate/spindown/zpool). Throws with the server message. */
export async function storageAction(path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${API_BASE}/proxmox/storage/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`)
  return data as ActionResult
}
