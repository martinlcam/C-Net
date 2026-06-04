"use client"

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google"
import { useEffect } from "react"
import { BdFooter } from "./components/BdFooter"
import { HeaderSection } from "../sections/HeaderSection"
import { BdHeroSection } from "./sections/BdHeroSection"
import { BdSignalsSection } from "./sections/BdSignalsSection"
import { BdSpecimenSection } from "./sections/BdSpecimenSection"
import { useBdStream } from "./lib/use-bd-stream"

// Fonts are loaded once at module scope so Next.js can inline them.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-bd-mono",
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-bd-display",
  display: "swap",
})

export default function BdPage() {
  const { connection, status, buffer, source } = useBdStream()

  // Theme-swap the body while /bd is mounted; revert on unmount so the rest
  // of the portfolio stays cream.
  useEffect(() => {
    document.body.dataset.bd = "1"
    return () => {
      delete document.body.dataset.bd
    }
  }, [])

  return (
    <div
      className={`${plexMono.variable} ${spaceGrotesk.variable} min-h-screen w-full bg-bd-bg text-bd-cream`}
    >
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />
      <BdHeroSection status={status} connection={connection} source={source} />
      <BdSignalsSection buffer={buffer} status={status} />
      <BdSpecimenSection status={status} />
      <BdFooter />
    </div>
  )
}
