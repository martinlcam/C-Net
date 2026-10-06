import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false },
}

export default function InviteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-white text-black">{children}</div>
}
