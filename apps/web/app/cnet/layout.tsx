import { redirect } from "next/navigation"
import { requireAuthorizedEmail } from "@/lib/authorization"
import { CnetShell } from "./cnet-shell"

export default async function CNetLayout({ children }: { children: React.ReactNode }) {
  let role: string | undefined
  try {
    const session = await requireAuthorizedEmail()
    role = session.user?.role
  } catch (_error) {
    // Same sign-in entry as the rest of C-Net (no separate Vault sign-in).
    redirect("/auth/signin?callbackUrl=/cnet/dashboard&error=Unauthorized")
  }

  return <CnetShell role={role}>{children}</CnetShell>
}
