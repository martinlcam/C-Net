const ALLOWED_EMAIL = "martinlucam@gmail.com"

export function isEmailAuthorized(email: string): boolean {
  return email === ALLOWED_EMAIL
}
