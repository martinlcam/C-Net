"use client"

import { Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { SignOutButton } from "@/components/SignOutButton"
import { MediaDownloadsWatcher } from "@/components/transfers/media-downloads-watcher"
import { TransferStatus } from "@/components/transfers/transfer-status"
import { CnetNav } from "./nav"
import { QuotaBar } from "./quota-bar"

export function CnetShell({ role, children }: { role?: string; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  const sidebar = (
    <>
      <h2 className="mb-6 font-bold text-2xl text-neutral-100">C-Net</h2>
      <CnetNav role={role} onNavigate={closeMenu} />
      <div className="mt-auto">
        <QuotaBar />
      </div>
      <div className="border-neutral-30 border-t pt-4">
        <SignOutButton />
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#faf6f1] font-satoshi">
      <header className="sticky top-0 z-40 flex items-center justify-between border-neutral-30 border-b bg-white px-4 py-3 md:hidden">
        <h2 className="font-bold text-xl text-neutral-100">C-Net</h2>
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-md p-2 text-neutral-100 hover:bg-neutral-10"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={closeMenu}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col overflow-y-auto border-neutral-30 border-r bg-white p-4 md:hidden">
            {sidebar}
          </aside>
        </>
      ) : null}

      <div className="flex">
        <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-neutral-30 border-r bg-white p-4 md:flex">
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>

      <TransferStatus />
      <MediaDownloadsWatcher />
    </div>
  )
}
