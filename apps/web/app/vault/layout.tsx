import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/SignOutButton"
import { requireAuthorizedEmail } from "@/lib/authorization"
import { VaultNav } from "./nav"

export default async function VaultLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAuthorizedEmail()
  } catch {
    redirect("/auth/signin?callbackUrl=/vault&error=Unauthorized")
  }

  return (
    <div className="min-h-screen bg-[#faf6f1]">
      <div className="flex">
        <aside className="flex min-h-screen w-64 flex-col border-neutral-30 border-r bg-white p-4">
          <h2 className="mb-6 font-bold text-2xl text-neutral-100">Vault</h2>
          <VaultNav />
          <div className="mt-auto border-neutral-30 border-t pt-4">
            <SignOutButton />
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
