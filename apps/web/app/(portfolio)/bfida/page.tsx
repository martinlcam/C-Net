"use client"

import { useState } from "react"
import { AuthModal } from "@/components/AuthModal"
import { FooterSection } from "../sections/FooterSection"
import { HeaderSection } from "../sections/HeaderSection"
import { BfidaGameSection } from "./sections/BfidaGameSection"
import { BfidaHeroSection } from "./sections/BfidaHeroSection"
import { BfidaScoreboardSection } from "./sections/BfidaScoreboardSection"
import { BfidaSolverSection } from "./sections/BfidaSolverSection"

export default function BfidaPage() {
  const [scoreVersion, setScoreVersion] = useState(0)

  return (
    <div className="min-h-screen w-full bg-[#faf6f1]">
      <AuthModal />
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />
      <BfidaHeroSection />
      <BfidaGameSection onScoreRecorded={() => setScoreVersion((v) => v + 1)} />
      <BfidaScoreboardSection refreshKey={scoreVersion} />
      <BfidaSolverSection />
      <FooterSection />
    </div>
  )
}
