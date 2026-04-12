"use client"

import { Text } from "@radix-ui/themes"
import { animate, stagger, svg } from "animejs"
import { useEffect, useRef } from "react"
import { Button } from "@/stories/button/button"

export function HeroSection() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      animate(svg.createDrawable(".hero-line"), {
        draw: ["0 0", "0 1"],
        ease: "outInSine",
        duration: 1000,
        delay: stagger(100),
        loop: false,
      })
    }
  }, [])

  return (
    <div className="border-b border-black md:border-l">
      <div className="flex">
        <div className="hidden md:flex w-[58px] border-r border-black flex-col items-center pt-2 shrink-0">
          <div className="flex flex-col items-center text-[48px] font-normal text-black leading-none tracking-tight">
            <span>C</span>
            <span className="text-[24px]">│</span>
            <span>N</span>
            <span>E</span>
            <span>T</span>
          </div>
        </div>

        <section
          id="home"
          className="flex-1 relative min-h-[70vh] flex items-center px-5 sm:px-8 md:px-10 py-10 sm:py-14 md:py-16 overflow-hidden"
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1400 600"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <path
              className="hero-line"
              d="M-100 100 Q 200 50, 400 150 T 800 100 T 1200 200 T 1600 100"
              stroke="#d4d4d4"
              strokeWidth="1"
              fill="none"
            />
            <path
              className="hero-line"
              d="M-100 200 Q 300 150, 500 250 T 900 200 T 1300 300 T 1600 200"
              stroke="#d4d4d4"
              strokeWidth="1"
              fill="none"
            />
            <path
              className="hero-line"
              d="M-100 300 Q 250 250, 450 350 T 850 300 T 1250 400 T 1600 300"
              stroke="#d4d4d4"
              strokeWidth="1"
              fill="none"
            />
            <path
              className="hero-line"
              d="M-100 400 Q 200 350, 400 450 T 800 400 T 1200 500 T 1600 400"
              stroke="#d4d4d4"
              strokeWidth="1"
              fill="none"
            />
            <path
              className="hero-line"
              d="M-100 500 Q 300 450, 500 550 T 900 500 T 1300 600 T 1600 500"
              stroke="#d4d4d4"
              strokeWidth="1"
              fill="none"
            />
          </svg>

          <div className="relative z-10 max-w-[750px]">
            <p className="text-gray-500 text-base sm:text-lg md:text-xl mb-3">Hey there, I'm</p>
            <h1 className="text-[56px] sm:text-[72px] md:text-[96px] font-bold text-black mb-3 tracking-tight leading-[0.95]">
              Martin Cam
              <span className="inline-block ml-2 sm:ml-3 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[#bea9e9] relative -top-8 sm:-top-12 md:-top-14" />
            </h1>
            <p className="text-base sm:text-lg text-gray-700 mb-3 leading-relaxed">
              I’m a Forward Deployed Engineer based in <Text color="indigo">Vancouver, Canada</Text>
              , building and shipping production software across the full stack.{" "}
              <a
                href="https://futurity.work"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <Text color="cyan">At Futurity</Text>
              </a>
              , an international AI startup, I work directly with enterprise clients to deploy
              on-premise AI systems, integrations, and custom plugins that support real operational
              workflows.
            </p>
            <p className="text-base sm:text-lg text-gray-700 mb-3 leading-relaxed">
              I spend much of my time writing production code end-to-end, building scalable
              features, interfaces, and backend systems that power AI-driven products.
            </p>
            <p className="text-base sm:text-lg text-gray-700 mb-3 leading-relaxed">
              I primarily work with TypeScript, React, Next.js, and Tailwind CSS, and also have
              experience with Express.js, Drizzle ORM, PostgreSQL, and Docker.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
              <Button
                asChild
                className="bg-black hover:bg-gray-800 text-white px-6 sm:px-8 py-4 rounded-[12px] text-base sm:text-lg font-medium h-auto w-full sm:w-auto"
              >
                <a href="#projects">View Projects</a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-black text-black hover:bg-gray-100 px-6 sm:px-8 py-4 rounded-[12px] text-base sm:text-lg font-medium h-auto w-full sm:w-auto"
              >
                <a href="#contact">Get in Touch</a>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
