import type { Metadata } from "next"
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper"
import { Providers } from "./providers"
import { StyleDebugger } from "@/components/StyleDebugger"
import "./globals.css"

export const metadata: Metadata = {
  title: "Martin's Portfolio",
  description: "C-Net API",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyleDebugger />
        <SessionProviderWrapper>
          <Providers>{children}</Providers>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
