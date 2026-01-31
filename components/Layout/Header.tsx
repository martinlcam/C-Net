'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-bold text-black">
              Your Name
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-neutral-70 hover:text-black transition-colors"
              >
                Home
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-neutral-70 hover:text-black transition-colors"
              >
                About
              </Link>
              <Link
                href="/projects"
                className="text-sm font-medium text-neutral-70 hover:text-black transition-colors"
              >
                Projects
              </Link>
              <Link
                href="/contact"
                className="text-sm font-medium text-neutral-70 hover:text-black transition-colors"
              >
                Contact
              </Link>
            </nav>
          </div>

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
                      <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
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
              <Button asChild size="sm">
                <Link href="/cnet/dashboard">C-Net</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
