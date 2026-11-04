// Plain-language text for the `error` codes next-auth sends to its error page, plus the
// `Unauthorized` reason the dashboard layout uses when it bounces a signed-out visitor.

export const AUTH_ERROR_PARAM = "auth_error"
export const AUTH_PROMPT_PARAM = "signin"

export function signInErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  switch (code) {
    case "AccessDenied":
      return "That Google account isn't on the list for C-Net. Ask Martin to add it, then try again."
    case "Unauthorized":
    case "SessionRequired":
      return "Sign in to open that page."
    case "Configuration":
      return "Sign-in isn't set up correctly on the server right now."
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCallbackError":
    case "Callback":
    case "OAuthAccountNotLinked":
      return "Google didn't finish signing you in. Try again."
    case "Verification":
      return "That sign-in link has expired. Start again."
    default:
      return "Sign-in didn't go through. Try again."
  }
}

/** Where to land after a successful sign-in; only same-site paths are honoured. */
export function safeCallbackUrl(raw: string | null | undefined): string {
  if (raw?.startsWith("/") && !raw.startsWith("//")) return raw
  return "/cnet/dashboard"
}
