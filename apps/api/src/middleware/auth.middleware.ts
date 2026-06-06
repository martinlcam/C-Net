import { verifyToken } from "@cnet/core"
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
  _scopes?: string[]
): Promise<unknown> {
  if (securityName !== "jwt") {
    return Promise.reject(new Error(`Unknown security scheme: ${securityName}`))
  }

  const token = extractToken(request)
  if (!token) {
    return Promise.reject(new Error("No authentication token provided"))
  }

  try {
    const user = verifyToken(token)
    return Promise.resolve(user)
  } catch {
    return Promise.reject(new Error("Invalid or expired token"))
  }
}
