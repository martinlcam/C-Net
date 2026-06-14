"use client"

import { FolderOpen, Palette, Shield, Star, Trash2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/stories/button/button"

type Item = { href: string; label: string; icon?: typeof FolderOpen }

function NavLink({ href, label, icon: Icon, active }: Item & { active: boolean }) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={`w-full justify-start gap-2 ${active ? "bg-neutral-10" : ""}`}
      >
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </Button>
    </Link>
  )
}

export function CnetNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const inVault = pathname.startsWith("/cnet/vault")
  const isSuper = role === "super"

  // Storage users (and anyone inside the vault) see the vault menu.
  if (inVault || !isSuper) {
    const vaultItems: Item[] = [
      { href: "/cnet/vault", label: "Files", icon: FolderOpen },
      { href: "/cnet/vault/starred", label: "Starred", icon: Star },
      { href: "/cnet/vault/colored", label: "Colored", icon: Palette },
      { href: "/cnet/vault/trash", label: "Trash", icon: Trash2 },
      ...(isSuper ? [{ href: "/cnet/vault/admin", label: "Admin", icon: Shield }] : []),
    ]
    return (
      <nav className="space-y-2">
        {isSuper ? (
          <Link href="/cnet/dashboard">
            <Button variant="ghost" className="mb-2 w-full justify-start text-neutral-70">
              ← C-Net
            </Button>
          </Link>
        ) : null}
        {vaultItems.map((it) => (
          <NavLink key={it.href} {...it} active={pathname === it.href} />
        ))}
      </nav>
    )
  }

  // Superuser dashboard menu.
  return (
    <nav className="space-y-2">
      <NavLink href="/cnet/dashboard" label="Overview" active={pathname === "/cnet/dashboard"} />
      <NavLink
        href="/cnet/dashboard/infrastructure/proxmox"
        label="Proxmox"
        active={pathname.includes("/proxmox")}
      />
      <NavLink
        href="/cnet/dashboard/monitoring"
        label="Monitoring"
        active={pathname.includes("/monitoring")}
      />
      <NavLink href="/cnet/vault" label="Vault" icon={FolderOpen} active={false} />
      <div className="mt-4 border-neutral-30 border-t pt-4">
        <p className="mb-2 px-3 font-semibold text-neutral-70 text-xs uppercase tracking-wider">
          Settings
        </p>
        <NavLink
          href="/cnet/dashboard/settings/integrations"
          label="Integrations"
          active={pathname.includes("/integrations")}
        />
      </div>
    </nav>
  )
}
