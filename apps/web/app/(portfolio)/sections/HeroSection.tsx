"use client"

import { Text } from "@radix-ui/themes"
import { type CSSProperties, useRef, useState } from "react"
import { requestFact, useFactTicker } from "@/lib/fact-ticker"
import { useDevicePixel } from "@/lib/use-device-pixel"
import { ContributionsGraph } from "../components/ContributionsGraph"
import styles from "./HeroSection.module.css"

/* two arcs around a ring: the arcs part on hover and turn half a revolution
   per click, and the ring pulses (see .targetBox in the stylesheet) */
function Target({ turns }: { turns: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <g className={styles.arcs}>
        <path
          className={styles.arcLow}
          d="M12 22.75C6.92003 22.75 2.49003 19.14 1.47003 14.17C1.39003 13.76 1.65003 13.37 2.05003 13.28C2.46003 13.2 2.85003 13.46 2.94003 13.86C3.82003 18.14 7.63003 21.25 12 21.25C16.36 21.25 20.17 18.16 21.06 13.9C21.14 13.49 21.54 13.23 21.95 13.32C22.36 13.4 22.62 13.8 22.53 14.21C21.49 19.15 17.07 22.75 12 22.75Z"
        />
        <path
          className={styles.arcHigh}
          d="M21.81 10.81C21.46 10.81 21.15 10.56 21.08 10.2C20.23 5.88001 16.41 2.73999 12 2.73999C7.61995 2.73999 3.80996 5.85 2.93996 10.13C2.85996 10.54 2.45996 10.79 2.04996 10.71C1.63996 10.63 1.37996 10.23 1.46996 9.82001C2.48996 4.85001 6.91995 1.23999 12 1.23999C17.13 1.23999 21.56 4.89 22.55 9.91C22.63 10.32 22.36 10.71 21.96 10.79C21.91 10.81 21.86 10.81 21.81 10.81Z"
        />
      </g>
      <path
        key={turns}
        className={styles.ring}
        data-pulse={turns > 0 || undefined}
        d="M12 14.25C10.76 14.25 9.75 13.24 9.75 12C9.75 10.76 10.76 9.75 12 9.75C13.24 9.75 14.25 10.76 14.25 12C14.25 13.24 13.24 14.25 12 14.25ZM12 11.25C11.59 11.25 11.25 11.59 11.25 12C11.25 12.41 11.59 12.75 12 12.75C12.41 12.75 12.75 12.41 12.75 12C12.75 11.59 12.41 11.25 12 11.25Z"
      />
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
  useDevicePixel(sheet, "--hx-dp")
  const { loading } = useFactTicker()
  const [turns, setTurns] = useState(0)

  return (
    <div className={styles.shell}>
      <section id="home" ref={sheet} className={styles.sheet} aria-labelledby="hero-name">
        {/* rails */}
        <div className={`${styles.box} ${styles.lrail}`}>
          {/* the target box drops a random fact into the masthead's ticker */}
          <button
            type="button"
            className={styles.targetBox}
            data-busy={loading > 0 || undefined}
            style={{ "--turns": turns } as CSSProperties}
            onClick={() => {
              setTurns((t) => t + 1)
              requestFact()
            }}
            aria-label="Run a random fact across the ticker"
            title="Random fact"
          >
            <Target turns={turns} />
          </button>
          <span className={styles.lowerBox} aria-hidden="true" />
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
          <p className={styles.caption}>Full-Stack Software Engineer</p>
        </div>
        <div className={`${styles.box} ${styles.t3}`} />
        <div className={`${styles.box} ${styles.t4}`}>
          <p className={styles.caption}>YVR</p>
        </div>

        {/* wordmark */}
        <div className={`${styles.box} ${styles.word}`}>
          <h1 id="hero-name" className="sr-only">
            Martin Cam
          </h1>
        </div>

        {/* tagline, split box, accent panel, caption box */}
        <div className={`${styles.box} ${styles.tag}`}>
          <p className={styles.lede}>
            Building and shipping production software across the full stack.
          </p>
          <p className={styles.body}>
            I’m a Full-Stack Software Engineer based in{" "}
            <Text color="indigo">Vancouver, Canada</Text>.{" "}
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
          <ContributionsGraph />
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
