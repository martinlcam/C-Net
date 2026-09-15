"use client"

import { Text } from "@radix-ui/themes"
import { animate, stagger, svg } from "animejs"
import { useEffect, useRef } from "react"
import { PortfolioHeroFrame } from "../components/PortfolioHeroFrame"
import styles from "./HeroSection.module.css"

function Target() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.5" />
      <circle cx="10" cy="10" r="4" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

const WAVES = [
  "M-100 100 Q 200 50, 400 150 T 800 100 T 1200 200 T 1600 100",
  "M-100 200 Q 300 150, 500 250 T 900 200 T 1300 300 T 1600 200",
  "M-100 300 Q 250 250, 450 350 T 850 300 T 1250 400 T 1600 300",
  "M-100 400 Q 200 350, 400 450 T 800 400 T 1200 500 T 1600 400",
  "M-100 500 Q 300 450, 500 550 T 900 500 T 1300 600 T 1600 500",
]

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
    <PortfolioHeroFrame>
      <section id="home" className={styles.sheet} aria-labelledby="hero-name">
        {/* top strip */}
        <div className={`${styles.box} ${styles.tileA}`}>
          <span className={styles.target}>
            <Target />
          </span>
          <p className={`${styles.caption} ${styles.captionBR}`}>Forward Deployed Engineer</p>
        </div>
        <div className={`${styles.box} ${styles.tileB}`}>
          <p className={`${styles.caption} ${styles.captionTR}`}>Futurity · Enterprise AI</p>
          <span className={styles.ruler} aria-hidden="true" />
        </div>
        <div className={`${styles.box} ${styles.tileC}`}>
          <p className={`${styles.caption} ${styles.captionBR}`}>Vancouver, Canada</p>
        </div>
        <div className={`${styles.box} ${styles.rail1}`} aria-hidden="true">
          <Target />
        </div>

        {/* wordmark */}
        <div className={`${styles.box} ${styles.word}`}>
          <p className={styles.label}>
            <span aria-hidden="true">✳</span> Hey there, I’m
          </p>
          <span className={styles.asterisk} aria-hidden="true">
            ✳
          </span>
          <h1 id="hero-name" className={styles.name}>
            Martin Cam
          </h1>
        </div>
        <div className={`${styles.box} ${styles.rail2}`} aria-hidden="true">
          <span className={styles.checker} />
        </div>

        {/* copy + accent panel */}
        <div className={`${styles.box} ${styles.copy}`}>
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
          <p className={styles.body}>
            I spend much of my time writing production code end-to-end, building scalable features,
            interfaces, and backend systems that power AI-driven products. I primarily work with
            TypeScript, React, Next.js, and Tailwind CSS, and also have experience with Express.js,
            Drizzle ORM, PostgreSQL, and Docker.
          </p>
          <p className={styles.slash}>/a full-stack practice/</p>
        </div>
        <div className={`${styles.box} ${styles.cta}`}>
          <div className={styles.panel}>
            <a href="#projects" className={`${styles.btn} ${styles.btnSolid}`}>
              View Projects
            </a>
            <a href="#contact" className={styles.btn}>
              Get in Touch
            </a>
          </div>
          <p className={`${styles.caption} ${styles.ctaCaption}`}>Projects / Contact / Work</p>
        </div>

        {/* bottom line-art tiles */}
        <div className={`${styles.box} ${styles.grid}`} aria-hidden="true">
          <span className={styles.pixel} />
        </div>
        <div className={`${styles.box} ${styles.lines}`}>
          <svg
            ref={svgRef}
            viewBox="0 0 1400 600"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            {WAVES.map((d) => (
              <path key={d} className="hero-line" d={d} stroke="#8a8a8a" strokeWidth="1" />
            ))}
          </svg>
          <p className={`${styles.caption} ${styles.captionBR}`}>Signal / Line Art</p>
        </div>
        <div className={`${styles.box} ${styles.rail3}`} aria-hidden="true">
          ⌗
        </div>
      </section>
    </PortfolioHeroFrame>
  )
}
