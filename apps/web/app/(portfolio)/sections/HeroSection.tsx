"use client"

import { Text } from "@radix-ui/themes"
import { createTimeline, stagger, svg } from "animejs"
import { type RefObject, useEffect, useRef } from "react"
import { useDevicePixel } from "@/lib/use-device-pixel"
import { ContributionsGraph } from "../components/ContributionsGraph"
import { Cognition, Consciousness } from "../components/symbols"
import styles from "./HeroSection.module.css"

/* the symbols draw themselves in: each outline is traced along its length,
   then the ink fills and the outline fades. The stylesheet hides both until
   this runs, and shows the symbols whole for readers who prefer less motion */
function useDrawIn(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const paths = Array.from(root.querySelectorAll("path"))
    const timeline = createTimeline()
      .add(paths, { strokeOpacity: 1, duration: 0 })
      .add(svg.createDrawable(paths), {
        draw: ["0 0", "0 1"],
        ease: "inOutQuad",
        duration: 2200,
        delay: stagger(250),
      })
      .add(paths, { fillOpacity: 1, strokeOpacity: 0, ease: "linear", duration: 700 }, "-=300")

    return () => {
      timeline.revert()
    }
  }, [ref])
}

function Target() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}

function CornerMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="18" height="18" rx="4" />
      <path d="M7 13V9a2 2 0 0 1 2-2h4" />
    </svg>
  )
}

export function HeroSection() {
  const sheet = useRef<HTMLElement>(null)
  const symbols = useRef<HTMLDivElement>(null)
  useDevicePixel(sheet, "--hx-dp")
  useDrawIn(symbols)

  return (
    <div className={styles.shell}>
      <section id="home" ref={sheet} className={styles.sheet} aria-labelledby="hero-name">
        {/* rails */}
        <div className={`${styles.box} ${styles.lrail}`} aria-hidden="true">
          <span className={styles.targetBox}>
            <Target />
          </span>
          <span className={styles.lowerBox} />
        </div>
        <div className={`${styles.box} ${styles.rrail}`} aria-hidden="true">
          <span className={styles.railBar} />
          <span className={styles.railMark}>
            <CornerMark />
          </span>
        </div>

        {/* top strip: four boxes */}
        <div className={`${styles.box} ${styles.t1}`} />
        <div className={`${styles.box} ${styles.t2}`}>
          <p className={styles.caption}>Forward Deployed Engineer</p>
        </div>
        <div className={`${styles.box} ${styles.t3}`} />
        <div className={`${styles.box} ${styles.t4}`}>
          <p className={styles.caption}>Vancouver, Canada</p>
        </div>

        {/* wordmark */}
        <div className={`${styles.box} ${styles.word}`}>
          <h1 id="hero-name" className="sr-only">
            Martin Cam
          </h1>
          <div ref={symbols} className={styles.symbols} aria-hidden="true">
            <Cognition />
            <Consciousness />
          </div>
        </div>

        {/* tagline, split box, accent panel, caption box */}
        <div className={`${styles.box} ${styles.tag}`}>
          <p className={styles.lede}>
            Building and shipping production software across the full stack.
          </p>
          <p className={styles.body}>
            I’m a Forward Deployed Engineer based in <Text color="indigo">Vancouver, Canada</Text>.{" "}
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
          <p className={styles.slash}>/a full-stack practice/</p>
        </div>
        <div className={`${styles.box} ${styles.mid}`} aria-hidden="true" />
        <div className={`${styles.box} ${styles.cta}`}>
          <div className={styles.panelWrap}>
            <div className={styles.panel}>
              <a href="#projects" className={`${styles.btn} ${styles.btnSolid}`}>
                View Projects
              </a>
              <a href="#contact" className={styles.btn}>
                Get in Touch
              </a>
            </div>
          </div>
        </div>
        <div className={`${styles.box} ${styles.rail3}`} aria-hidden="true" />
        <div className={`${styles.box} ${styles.cap}`}>
          <p className={`${styles.caption} ${styles.ctaCaption}`}>Projects / Contact / Work</p>
        </div>

        {/* bottom row: four boxes */}
        <div className={`${styles.box} ${styles.b1}`}>
          <ContributionsGraph title="Ancient Paintings" />
        </div>
        <div className={`${styles.box} ${styles.b3}`}>
          <p className={styles.body}>
            I spend much of my time writing production code end-to-end, building scalable features,
            interfaces, and backend systems that power AI-driven products. I primarily work with
            TypeScript, React, Next.js, and Tailwind CSS, and also have experience with Express.js,
            Drizzle ORM, PostgreSQL, and Docker.
          </p>
        </div>
        <div className={`${styles.box} ${styles.b4top}`} aria-hidden="true" />
        <div className={`${styles.box} ${styles.b4}`} aria-hidden="true" />
        <div className={`${styles.box} ${styles.rrail2}`} aria-hidden="true" />
      </section>
    </div>
  )
}
