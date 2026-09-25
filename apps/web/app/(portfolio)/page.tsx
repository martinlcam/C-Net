"use client"

import { AuthModal } from "@/components/AuthModal"
import { AboutSection } from "./sections/AboutSection"
import { ContactSection } from "./sections/ContactSection"
import { FooterSection } from "./sections/FooterSection"
import { HeaderSection } from "./sections/HeaderSection"
import { HeroSection } from "./sections/HeroSection"
import { ProjectsSection } from "./sections/ProjectsSection"

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-[#faf6f1]">
      <AuthModal />
      <HeaderSection />
      <HeroSection />
      <div>
        <AboutSection />
        <ProjectsSection />
        <ContactSection />
        <FooterSection />
      </div>
    </div>
  )
}
