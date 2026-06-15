import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/SignOutButton"
import { requireAuthorizedEmail } from "@/lib/authorization"
import { CnetNav } from "./nav"
import { QuotaBar } from "./quota-bar"

export default async function CNetLayout({ children }: { children: React.ReactNode }) {
  let role: string | undefined
  try {
    const session = await requireAuthorizedEmail()
    role = session.user?.role
  } catch (_error) {
    // Same sign-in entry as the rest of C-Net (no separate Vault sign-in).
    redirect("/auth/signin?callbackUrl=/cnet/dashboard&error=Unauthorized")
  }

  return (
    <div className="min-h-screen bg-[#faf6f1] font-satoshi">
      <div className="flex">
        {/* Sidebar — admin/settings super-only; storage users see overview + vault */}
        <aside className="flex min-h-screen w-64 flex-col border-neutral-30 border-r bg-white p-4">
          <h2 className="mb-6 font-bold text-2xl text-neutral-100">C-Net</h2>
          <CnetNav role={role} />
          <div className="mt-auto">
            <QuotaBar />
          </div>
          <div className="border-neutral-30 border-t pt-4">
            <SignOutButton />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
