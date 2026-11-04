import { redirect } from "next/navigation"
import { AUTH_ERROR_PARAM, AUTH_PROMPT_PARAM, safeCallbackUrl } from "@/lib/auth-messages"

// Anything that asks for the sign-in page (next-auth itself, the dashboard layout bouncing a
// signed-out visitor, the old header link) gets the portfolio with its sign-in dialog open,
// carrying the reason and where to return to.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>
}) {
  const params = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const query = new URLSearchParams()
  const error = first(params.error)
  if (error) query.set(AUTH_ERROR_PARAM, error)
  else query.set(AUTH_PROMPT_PARAM, "1")
  query.set("callbackUrl", safeCallbackUrl(first(params.callbackUrl)))
  redirect(`/?${query.toString()}`)
}
