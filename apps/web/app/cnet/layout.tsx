import Link from "next/link"
import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/SignOutButton"
import { requireAuthorizedEmail } from "@/lib/authorization"
import { Button } from "@/stories/button/button"

export default async function CNetLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAuthorizedEmail()
  } catch (_error) {
    // Redirect to sign-in if not authorized
    redirect("/auth/signin?callbackUrl=/cnet/dashboard&error=Unauthorized")
  }

  return (
    <div className="min-h-screen bg-[#faf6f1]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-neutral-30 min-h-screen p-4 flex flex-col">
          <h2 className="text-2xl font-bold text-neutral-100 mb-6">C-Net</h2>
          <nav className="space-y-2">
            <Link href="/cnet/dashboard">
              <Button variant="ghost" className="w-full justify-start">
                Overview
              </Button>
            </Link>
            <Link href="/cnet/dashboard/infrastructure/proxmox">
              <Button variant="ghost" className="w-full justify-start">
                Proxmox
              </Button>
            </Link>
            <Link href="/cnet/dashboard/monitoring">
              <Button variant="ghost" className="w-full justify-start">
                Monitoring
              </Button>
            </Link>
            <div className="pt-4 mt-4 border-t border-neutral-30">
              <p className="px-3 text-xs font-semibold text-neutral-70 uppercase tracking-wider mb-2">
                Settings
              </p>
              <Link href="/cnet/dashboard/settings/integrations">
                <Button variant="ghost" className="w-full justify-start">
                  Integrations
                </Button>
              </Link>
            </div>
          </nav>

          <div className="mt-auto pt-4 border-t border-neutral-30">
            <SignOutButton />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
