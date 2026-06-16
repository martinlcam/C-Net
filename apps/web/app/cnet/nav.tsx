"use client"

import { FolderOpen, Palette, Shield, Star, Trash2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/stories/button/button"

type Item = { href: string; label: string; icon?: typeof FolderOpen }

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: Item & { active: boolean; onNavigate?: () => void }) {
  return (
    <Link href={href} onClick={onNavigate}>
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

export function CnetNav({ role, onNavigate }: { role?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const isSuper = role === "super"

  const fileItems: Item[] = [
    { href: "/cnet/dashboard/files", label: "Files", icon: FolderOpen },
    { href: "/cnet/dashboard/starred", label: "Starred", icon: Star },
    { href: "/cnet/dashboard/colored", label: "Colored", icon: Palette },
    { href: "/cnet/dashboard/trash", label: "Trash", icon: Trash2 },
    ...(isSuper ? [{ href: "/cnet/dashboard/admin", label: "Admin", icon: Shield }] : []),
  ]

  return (
    <nav className="space-y-2">
      <NavLink
        href="/cnet/dashboard"
        label="Overview"
        active={pathname === "/cnet/dashboard"}
        onNavigate={onNavigate}
      />
      <NavLink
        href="/cnet/dashboard/infrastructure/proxmox"
        label="Proxmox"
        active={pathname.includes("/proxmox")}
        onNavigate={onNavigate}
      />
      <NavLink
        href="/cnet/dashboard/monitoring"
        label="Monitoring"
        active={pathname.includes("/monitoring")}
        onNavigate={onNavigate}
      />
      <div className="my-4 border-neutral-30 border-t pt-4">
        <p className="mb-2 px-3 font-semibold text-neutral-70 text-xs uppercase tracking-wider">
          Storage
        </p>
      </div>
      {fileItems.map((it) => (
        <NavLink key={it.href} {...it} active={pathname === it.href} onNavigate={onNavigate} />
      ))}
      {isSuper ? (
        <div className="mt-4 border-neutral-30 border-t pt-4">
          <p className="mb-2 px-3 font-semibold text-neutral-70 text-xs uppercase tracking-wider">
            Settings
          </p>
          <NavLink
            href="/cnet/dashboard/settings/integrations"
            label="Integrations"
            active={pathname.includes("/integrations")}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}
    </nav>
  )
}
