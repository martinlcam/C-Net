"use client"

import { AuthModal } from "@/components/AuthModal"
import { FooterSection } from "../sections/FooterSection"
import { HeaderSection } from "../sections/HeaderSection"
import { BfidaGameSection } from "./sections/BfidaGameSection"
import { BfidaHeroSection } from "./sections/BfidaHeroSection"
import { BfidaSolverSection } from "./sections/BfidaSolverSection"

export default function BfidaPage() {
  return (
    <div className="min-h-screen w-full bg-[#faf6f1]">
      <AuthModal />
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />
      <BfidaHeroSection />
      <BfidaGameSection />
      <BfidaSolverSection />
      <FooterSection />
    </div>
  )
}
