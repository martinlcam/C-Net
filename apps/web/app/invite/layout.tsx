import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false },
}

// font-satoshi is explicit because the root Radix <Theme> overrides the body font family.
// The cream ground matches the portfolio home page.
export default function InviteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-[#faf6f1] font-satoshi text-black">{children}</div>
}
