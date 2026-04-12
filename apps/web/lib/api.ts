import { getSession } from "next-auth/react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await getSession()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (session) {
    /* The session token is available via cookies — for server-side calls,
       we may need to pass it differently. This is a client-side wrapper. */
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || "API request failed")
  }

  return response.json()
}
