import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminVault } from "./admin-client"

export default async function AdminVaultPage() {
  const session = await getServerAuthSession()
  if (session?.user?.role !== "super") {
    redirect("/vault")
  }
  return (
    <div className="min-h-screen bg-[#faf6f1] p-8">
      <AdminVault />
    </div>
  )
}
