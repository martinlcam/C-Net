"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { useAuthModal } from "@/lib/stores/auth-modal"
import { Button } from "@/stories/button/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/stories/dropdown-menu/dropdown-menu"

const mobileNavItems = [
  { title: "Home", href: "/#home" },
  { title: "About", href: "/#about" },
  { title: "Projects", href: "/#projects" },
  { title: "Contact", href: "/#contact" },
  { title: "BFIDA", href: "/bfida" },
  { title: "BD", href: "/bd" },
]

const desktopNavItems = [
  { title: "Home", href: "/#home" },
  { title: "About", href: "/#about" },
  { title: "Projects", href: "/#projects" },
  { title: "Contact", href: "/#contact" },
  { title: "BFIDA", href: "/bfida" },
  { title: "BD", href: "/bd" },
]

export function HeaderSection() {
  const { data: session, status } = useSession()
  const { openModal } = useAuthModal()
  const pathname = usePathname()
  const [isAtTop, setIsAtTop] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const isBd = pathname === "/bd"

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return pathname === "/"
    return pathname === href
  }

  useEffect(() => {
    const handleScroll = () => setIsAtTop(window.scrollY === 0)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)
  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !(target as Element).closest('button[aria-label="Toggle mobile menu"]')
      ) {
        setIsMobileMenuOpen(false)
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false)
    }

    if (isMobileMenuOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside)
      }, 100)
      document.addEventListener("keydown", handleEscapeKey)
      document.body.style.overflow = "hidden"

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener("mousedown", handleClickOutside)
        document.removeEventListener("keydown", handleEscapeKey)
        document.body.style.overflow = "unset"
      }
    }

    document.body.style.overflow = "unset"
    return undefined
  }, [isMobileMenuOpen])

  return (
    <header
      className={`flex border-b fixed top-0 left-0 right-0 z-50 backdrop-blur-sm md:border-l transition-colors ${
        isBd ? "bg-[#0d0d0f] border-bd-rule" : "bg-[#faf6f1] border-black"
      }`}
    >
      <div
        className={`hidden md:flex w-[58px] h-16 items-center justify-center shrink-0 transition-all ${
          isAtTop ? (isBd ? "border-r border-bd-rule" : "border-r border-black") : ""
        }`}
      />
      <div className="flex-1 flex items-center justify-between px-6">
        <nav className="hidden md:flex items-center gap-6">
          {desktopNavItems.map((item) => {
            const active = isActive(item.href)
            const isBfidaActive = active && item.title === "BFIDA"
            const isBdActive = active && item.title === "BD"
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[24px] font-normal transition-colors ${
                  isBdActive
                    ? "text-[#c6ff00] hover:text-[#daff66]"
                    : isBfidaActive
                      ? isBd
                        ? "text-[#ad70eb] hover:text-[#bea9e9]"
                        : "text-[#ad70eb] hover:text-[#bea9e9]"
                      : isBd
                        ? "text-[#faf6f1] hover:text-[#faf6f1]/60"
                        : "text-black hover:text-gray-600"
                }`}
              >
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="md:hidden flex ml-auto pr-2">
          <button
            type="button"
            className={`relative p-3 rounded-[12px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:ring-offset-2 z-50 border ${
              isBd
                ? "bg-[#0d0d0f] hover:bg-bd-panel border-bd-rule"
                : "bg-[#faf6f1] hover:bg-gray-100 border-black"
            }`}
            onClick={(e) => {
              e.stopPropagation()
              toggleMobileMenu()
            }}
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
          >
            <div className="relative w-6 h-6 flex items-center justify-center">
              <span
                className={`absolute block h-0.5 w-5 transition-all duration-300 ${
                  isBd ? "bg-bd-cream" : "bg-gray-700"
                } ${isMobileMenuOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"}`}
              />
              <span
                className={`absolute block h-0.5 w-5 transition-all duration-300 ${
                  isBd ? "bg-bd-cream" : "bg-gray-700"
                } ${isMobileMenuOpen ? "opacity-0" : "opacity-100"}`}
              />
              <span
                className={`absolute block h-0.5 w-5 transition-all duration-300 ${
                  isBd ? "bg-bd-cream" : "bg-gray-700"
                } ${isMobileMenuOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"}`}
              />
            </div>
          </button>
        </div>

        <div
          ref={mobileMenuRef}
          className={`fixed left-1/2 top-24 z-40 w-[calc(100%-3rem)] max-w-lg -translate-x-1/2 rounded-[12px] border shadow-2xl md:hidden transition-all duration-300 ease-out ${
            isBd ? "border-bd-rule bg-[#0d0d0f]" : "border-black bg-[#faf6f1]"
          } ${
            isMobileMenuOpen
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          <div className="flex flex-col p-4 space-y-1">
            {mobileNavItems.map((item) => {
              const active = isActive(item.href)
              const isBfidaActive = active && item.title === "BFIDA"
              const isBdActive = active && item.title === "BD"
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 text-[17px] font-medium rounded-[12px] transition-colors duration-200 ${
                    isBdActive
                      ? "text-[#c6ff00] hover:bg-bd-panel"
                      : isBfidaActive
                        ? isBd
                          ? "text-[#ad70eb] hover:bg-bd-panel"
                          : "text-[#ad70eb] hover:bg-purple-50"
                        : isBd
                          ? "text-bd-cream hover:bg-bd-panel"
                          : "text-black hover:bg-gray-100"
                  }`}
                  onClick={closeMobileMenu}
                >
                  {item.title}
                </Link>
              )
            })}
            {!isBd && (
              <div className="flex items-center justify-center py-2 pt-4">
                <div className="h-px w-full bg-black" />
              </div>
            )}
            {isBd ? null : status === "loading" ? (
              <div className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            ) : session ? (
              <>
                <Link
                  href="/cnet/dashboard"
                  className="block px-4 py-3 text-[17px] font-medium text-[#ad70eb] rounded-[12px] hover:bg-purple-50 transition-colors duration-200"
                  onClick={closeMobileMenu}
                >
                  C-Net
                </Link>
                <div className="px-4 py-2">
                  <p
                    className={`text-sm font-medium truncate ${isBd ? "text-bd-cream" : "text-black"}`}
                  >
                    {session.user?.name || "User"}
                  </p>
                  <p
                    className={`text-xs truncate ${isBd ? "text-bd-cream/50" : "text-gray-600"}`}
                  >
                    {session.user?.email}
                  </p>
                </div>
                <Link
                  href="/cnet/dashboard"
                  className={`block px-4 py-3 text-[17px] font-medium rounded-[12px] transition-colors duration-200 ${
                    isBd
                      ? "text-bd-cream hover:bg-bd-panel"
                      : "text-black hover:bg-gray-100"
                  }`}
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-3 text-[17px] font-medium rounded-[12px] transition-colors duration-200 ${
                    isBd
                      ? "text-bd-cream hover:bg-bd-panel"
                      : "text-black hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    signOut()
                    closeMobileMenu()
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="w-full text-left px-4 py-3 text-[17px] font-medium text-black rounded-[12px] hover:bg-gray-100 transition-colors duration-200"
                onClick={() => {
                  openModal()
                  closeMobileMenu()
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        <div
          className={`fixed inset-0 z-30 bg-black/10 md:hidden transition-opacity duration-300 ${
            isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />

        <div className="hidden md:flex items-center gap-4">
          {isBd ? null : status === "loading" ? (
            <div
              className={`h-12 w-24 animate-pulse rounded-xl ${
                isBd ? "bg-bd-cream/10" : "bg-gray-100"
              }`}
            />
          ) : session ? (
            <>
              <Button
                asChild
                variant="outline"
                className={`rounded-[12px] px-7 py-3.5 h-12 text-lg font-medium ${
                  isBd
                    ? "border-bd-purple/50 text-bd-purple hover:bg-bd-panel"
                    : "border-[#ddc9f7] text-[#ad70eb] hover:bg-purple-50"
                }`}
              >
                <Link href="/cnet/dashboard">C-Net</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isBd ? "bg-bd-cream text-bd-bg" : "bg-black text-white"
                      }`}
                    >
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
              onClick={openModal}
              variant="outline"
              className={`rounded-[12px] px-7 py-3.5 h-12 text-lg font-medium ${
                isBd
                  ? "border-bd-cream/30 text-bd-cream hover:bg-bd-panel"
                  : "border-black text-black hover:bg-gray-100"
              }`}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
