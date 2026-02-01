"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Button } from "@/stories/button/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/stories/dropdown-menu/dropdown-menu"

export function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const isHomePage = pathname === "/"

  const scrollToSection = (sectionId: string) => {
    if (!isHomePage) {
      window.location.href = `/#${sectionId}`
      return
    }
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <header className="h-16 bg-white">
      <div className="flex h-full items-center justify-between px-8">
        {/* Left Navigation - Left aligned - BLACK text */}
        <nav className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => scrollToSection("home")}
            className="text-base font-normal text-black hover:text-gray-600 transition-colors"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("about")}
            className="text-base font-normal text-black hover:text-gray-600 transition-colors"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("projects")}
            className="text-base font-normal text-black hover:text-gray-600 transition-colors"
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("contact")}
            className="text-base font-normal text-black hover:text-gray-600 transition-colors"
          >
            Contact
          </button>
        </nav>

        {/* Right side - Auth */}
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="h-10 w-20 bg-gray-200 animate-pulse rounded-xl" />
          ) : session ? (
            <>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl border-black text-black hover:bg-gray-100"
              >
                <Link href="/cnet/dashboard">C-Net</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
                      {session.user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-black">{session.user?.name || "User"}</p>
                    <p className="text-xs text-gray-600">{session.user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/cnet/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-xl border-black text-black hover:bg-gray-100 px-5 py-3"
            >
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
