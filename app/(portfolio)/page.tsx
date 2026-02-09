"use client"

import { AuthModal } from "@/components/AuthModal"
import { HeaderSection } from "./sections/HeaderSection"
import { HeroSection } from "./sections/HeroSection"
import { TechStripSection } from "./sections/TechStripSection"
import { AboutSection } from "./sections/AboutSection"
import { ProjectsSection } from "./sections/ProjectsSection"
import { ContactSection } from "./sections/ContactSection"
import { FooterSection } from "./sections/FooterSection"

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-[#faf6f1]">
      <AuthModal />
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />
      <HeroSection />
      <TechStripSection />
      <div>
        <AboutSection />
        <ProjectsSection />
        <ContactSection />
        <FooterSection />
      </div>
    </div>
  )
}
