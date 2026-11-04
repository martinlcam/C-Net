import { redirect } from "next/navigation"
import { AUTH_ERROR_PARAM } from "@/lib/auth-messages"

// next-auth sends a failed sign-in here with `?error=<code>`. There is nothing to show on a
// page of its own: the portfolio's sign-in dialog reopens with the reason instead.
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { error } = await searchParams
  const code = Array.isArray(error) ? error[0] : error
  redirect(`/?${AUTH_ERROR_PARAM}=${encodeURIComponent(code || "Default")}`)
}
