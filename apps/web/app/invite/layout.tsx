import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false },
}

// resizes-content makes Android Chrome shrink the page when the keyboard opens, so the
// bottom-pinned RSVP sheet moves above it natively. iOS ignores this and relies on the
// visual-viewport lift in rsvp-dialog.tsx instead.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
}

// font-satoshi is explicit because the root Radix <Theme> overrides the body font family.
// The cream ground matches the portfolio home page.
export default function InviteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-[#faf6f1] font-satoshi text-black">{children}</div>
}
