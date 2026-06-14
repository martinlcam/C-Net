import { redirect } from "next/navigation"

// The Vault moved under the C-Net service. Keep old links working.
export default function VaultRedirect() {
  redirect("/cnet/vault")
}
