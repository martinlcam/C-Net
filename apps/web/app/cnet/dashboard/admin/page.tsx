import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { AdminVault } from "./admin-client"

export default async function AdminVaultPage() {
  const session = await getServerAuthSession()
  if (session?.user?.role !== "super") {
    redirect("/cnet/dashboard/files")
  }
  return <AdminVault />
}
