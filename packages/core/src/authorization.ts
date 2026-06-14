import { isEmailAuthorized as check } from "./access/allowlist"

export function isEmailAuthorized(email: string): boolean {
  return check(email)
}
