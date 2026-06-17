import { isSuperuser, verifyToken } from "@cnet/core"
import type { Request } from "express"

/**
 * NextAuth session-cookie names, newest (Auth.js v5) first, including the
 * `__Secure-` prefixed production variants. The cookie value is a JWT signed
 * with NEXTAUTH_SECRET, which `verifyToken` validates with the same secret.
 */
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
]

/** Pull the JWT from the Authorization header, falling back to the session cookie. */
function extractToken(request: Request): string | null {
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies
  if (cookies) {
    for (const name of SESSION_COOKIE_NAMES) {
      const value = cookies[name]
      if (value) return value
    }
  }

  return null
}

export function expressAuthentication(
  request: Request,
  securityName: string,
  scopes?: string[]
): Promise<unknown> {
  if (securityName !== "jwt") {
    return Promise.reject(new Error(`Unknown security scheme: ${securityName}`))
  }

  const token = extractToken(request)
  if (!token) {
    return Promise.reject(new Error("No authentication token provided"))
  }

  let user: ReturnType<typeof verifyToken>
  try {
    user = verifyToken(token)
  } catch {
    return Promise.reject(new Error("Invalid or expired token"))
  }

  // `superuser` scope gates host-global admin features (e.g. the ZFS bay GUI) to
  // the allowlisted owner. Reuses the same email allowlist as the Vault. Named
  // ForbiddenError so the error handler maps it to 403 (not 500).
  if (scopes?.includes("superuser") && !isSuperuser(user.email)) {
    const forbidden = new Error("Forbidden: superuser access required")
    forbidden.name = "ForbiddenError"
    return Promise.reject(forbidden)
  }

  return Promise.resolve(user)
}
