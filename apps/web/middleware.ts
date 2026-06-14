import { type NextRequest, NextResponse } from "next/server"

// Edge-safe storage-role guard.
//
// The Vault is enforced server-side: the API returns 401 for unauthenticated
// requests and server components/layouts enforce authorization. This middleware
// only provides the UX redirect that keeps "storage"-role users inside /vault.
//
// It deliberately does NOT import the auth config: that config overrides the JWT
// codec with `jsonwebtoken`, which depends on Node's `crypto` — unavailable in
// the Edge runtime where middleware runs (importing it 500s every request).
// Instead we read the role from the session JWT payload WITHOUT verifying its
// signature. That is sufficient for a redirect (forging a token only changes
// what UI a user is steered to; the API/layouts still authorize every action)
// and keeps the middleware free of Node-only crypto. Anything unexpected fails
// open, so site availability never depends on this guard.

const SESSION_COOKIE_FRAGMENT = "authjs.session-token"
const ALLOWED_PREFIXES = ["/vault", "/api/auth", "/auth"]

function b64urlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function readRole(req: NextRequest): string | undefined {
  // Collect the session cookie, reassembling Auth.js chunks (name.0, name.1, ...).
  const chunks = req.cookies
    .getAll()
    .filter((c) => c.name.includes(SESSION_COOKIE_FRAGMENT))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (chunks.length === 0) return undefined
  const payload = chunks.map((c) => c.value).join("").split(".")[1]
  if (!payload) return undefined
  try {
    const claims = JSON.parse(b64urlDecode(payload)) as { role?: unknown }
    return typeof claims.role === "string" ? claims.role : undefined
  } catch {
    return undefined
  }
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (readRole(req) === "storage" && !ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/vault", req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
