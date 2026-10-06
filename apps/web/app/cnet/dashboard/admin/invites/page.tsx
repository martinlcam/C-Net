import { redirect } from "next/navigation"
import { getServerAuthSession } from "@/lib/auth"
import { InvitesAdmin } from "./invites-client"

export default async function InvitesAdminPage() {
  const session = await getServerAuthSession()
  if (session?.user?.role !== "super") {
    redirect("/cnet/dashboard/files")
  }
  return <InvitesAdmin />
}
