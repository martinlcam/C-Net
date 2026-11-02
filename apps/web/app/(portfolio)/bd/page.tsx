"use client"

import localFont from "next/font/local"
import { useEffect } from "react"
import { HeaderSection } from "../sections/HeaderSection"
import { BdFooter } from "./components/BdFooter"
import { BdVectorField } from "./components/BdVectorField"
import { useBdStream } from "./lib/use-bd-stream"
import { BdHeroSection } from "./sections/BdHeroSection"
import { BdSignalsSection } from "./sections/BdSignalsSection"
import { BdSpecimenSection } from "./sections/BdSpecimenSection"

// Fonts are loaded once at module scope so Next.js can inline them. They are the fontsource
// copies rather than next/font/google: the build fetched from Google Fonts and failed
// whenever Google answered with its `/l/font?kit=` URLs, which Turbopack cannot parse.
const plexMono = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-300-normal.woff2",
      weight: "300",
    },
    {
      path: "../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      weight: "500",
    },
  ],
  variable: "--font-bd-mono",
  display: "swap",
})

const spaceGrotesk = localFont({
  src: "../../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
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
      className={`${plexMono.variable} ${spaceGrotesk.variable} relative min-h-screen w-full bg-bd-bg text-bd-cream`}
    >
      <BdVectorField />
      <div className="relative z-[1]">
        <HeaderSection />
        <div className="h-[65px]" aria-hidden="true" />
        <BdHeroSection status={status} connection={connection} source={source} />
        <BdSignalsSection buffer={buffer} status={status} />
        <BdSpecimenSection status={status} />
        <BdFooter />
      </div>
    </div>
  )
}
