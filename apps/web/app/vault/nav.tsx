"use client"

import { FolderOpen, Shield, Trash2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/stories/button/button"

type NavItem = { href: string; label: string; icon: typeof FolderOpen }

export function VaultNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isSuper = session?.user?.role === "super"

  const items: NavItem[] = [
    { href: "/vault", label: "Files", icon: FolderOpen },
    { href: "/vault/trash", label: "Trash", icon: Trash2 },
    ...(isSuper ? [{ href: "/admin/vault", label: "Admin", icon: Shield }] : []),
  ]

  return (
    <nav className="space-y-2">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 ${pathname === href ? "bg-neutral-10" : ""}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        </Link>
      ))}
    </nav>
  )
}
