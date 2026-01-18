import { redirect } from 'next/navigation'
import { requireAuthorizedEmail } from '@/lib/authorization'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function CNetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    await requireAuthorizedEmail()
  } catch (error) {
    // Redirect to sign-in if not authorized
    redirect('/auth/signin?callbackUrl=/cnet/dashboard&error=Unauthorized')
  }

  return (
    <div className="min-h-screen bg-neutral-10">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-neutral-30 min-h-screen p-4">
          <h2 className="text-2xl font-bold text-primary-purple-60 mb-6">C-Net Dashboard</h2>
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
