export interface JWTPayload {
  sub: string
  id: string
  email: string
  name: string
  iat: number
  exp: number
}

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
}
