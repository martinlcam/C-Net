import { verifyToken } from "@cnet/core"
import type { Request } from "express"

export function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[]
): Promise<unknown> {
  if (securityName !== "jwt") {
    return Promise.reject(new Error(`Unknown security scheme: ${securityName}`))
  }

  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return Promise.reject(new Error("No Bearer token provided"))
  }

  const token = authHeader.slice(7)

  try {
    const user = verifyToken(token)
    return Promise.resolve(user)
  } catch {
    return Promise.reject(new Error("Invalid or expired token"))
  }
}
