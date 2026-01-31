'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Button } from '@/stories/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/stories/dropdown-menu/dropdown-menu'

export function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const isHomePage = pathname === '/'

  const scrollToSection = (sectionId: string) => {
    if (!isHomePage) {
      window.location.href = `/#${sectionId}`
      return
    }
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="fixed top-0 right-0 z-50 w-[calc(100%-48px)] ml-12">
      {/* Top border line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-neutral-30" />
      
      <div className="flex h-16 items-center justify-between px-8 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        {/* Left side - Name/Logo */}
        <Link href="/" className="text-xl font-medium text-neutral-100 tracking-tight">
          Martin Cam<span className="text-accent-green-50">.</span>
        </Link>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            type="button"
            onClick={() => scrollToSection('home')}
            className="text-sm font-medium text-neutral-60 hover:text-neutral-100 transition-colors"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className="text-sm font-medium text-neutral-60 hover:text-neutral-100 transition-colors"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('projects')}
            className="text-sm font-medium text-neutral-60 hover:text-neutral-100 transition-colors"
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="text-sm font-medium text-neutral-60 hover:text-neutral-100 transition-colors"
          >
            Contact
          </button>
        </nav>

        {/* Right side - Auth */}
        <div className="flex items-center gap-4">
          {status === 'loading' ? (
            <div className="h-9 w-20 bg-neutral-20 animate-pulse rounded" />
          ) : session ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/cnet/dashboard">C-Net</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center text-white text-sm font-medium">
                      {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-neutral-100">
                      {session.user?.name || 'User'}
                    </p>
                    <p className="text-xs text-neutral-70">{session.user?.email}</p>
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
            <Button asChild size="sm" className="bg-neutral-100 hover:bg-neutral-80 text-white">
              <Link href="/auth/signin">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
