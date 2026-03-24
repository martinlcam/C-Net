import jwt from "jsonwebtoken"
import type { AuthenticatedUser, JWTPayload } from "./types"

export function verifyToken(token: string): AuthenticatedUser {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is not set")
  }

  const payload = jwt.verify(token, secret) as JWTPayload

  return {
    id: payload.id || payload.sub,
    email: payload.email,
    name: payload.name,
  }
}
