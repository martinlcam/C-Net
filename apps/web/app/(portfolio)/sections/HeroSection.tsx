"use client"

import { Text } from "@radix-ui/themes"
import { useRef } from "react"
import { useDevicePixel } from "@/lib/use-device-pixel"
import styles from "./HeroSection.module.css"

function Target() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  )
}

/* the "Cognition" symbol from the pedrostolf set, traced by potrace: the
   drawing is upside down in a 10x scale, hence the flip in the transform */
function Cognition() {
  return (
    <svg viewBox="0 0 175 226" fill="currentColor" aria-hidden="true">
      <path
        transform="translate(0 226) scale(0.1 -0.1)"
        d="M872 2048 c-20 -20 -15 -28 67 -108 140 -135 160 -232 71 -333 -30 -35 -31 -35 -65 -21 -45 18 -112 18 -149 -1 -30 -16 -30 -16 -123 77 -88 88 -94 92 -110 75 -17 -16 -11 -24 117 -152 l135 -135 -223 0 c-215 0 -222 -1 -222 -20 0 -19 7 -20 117 -20 l117 0 -196 -197 c-139 -141 -198 -207 -203 -228 -4 -16 -9 -36 -11 -44 -11 -36 20 -97 82 -161 64 -67 64 -67 64 -208 0 -142 0 -142 25 -142 25 0 25 0 25 117 l0 118 233 -233 c127 -127 237 -232 243 -232 7 0 16 6 22 13 9 10 -47 71 -243 267 l-255 255 0 195 0 195 143 143 143 143 182 0 c219 0 199 9 362 -155 l125 -126 3 -198 3 -197 -135 -135 c-142 -141 -152 -148 -201 -149 -29 -1 -28 0 37 67 79 80 88 97 88 157 0 62 -15 87 -107 176 -134 130 -192 131 -325 2 -152 -148 -149 -214 14 -370 74 -71 107 -83 223 -83 131 0 144 7 283 143 l122 121 0 -117 c0 -117 0 -117 25 -117 25 0 25 0 25 143 0 143 0 143 56 197 90 89 113 153 78 223 -9 18 -102 119 -207 225 l-192 192 117 0 c90 0 117 3 121 14 10 25 -2 26 -227 26 l-220 0 71 73 c159 160 155 270 -16 445 -102 103 -93 96 -109 80z m53 -509 c6 -6 -3 -21 -23 -41 -32 -32 -32 -32 -62 -3 -17 16 -29 34 -27 39 8 24 87 27 112 5z m-585 -611 c0 -142 0 -142 -40 -103 -48 46 -66 97 -51 137 9 24 77 108 87 108 2 0 4 -64 4 -142z m1146 50 c27 -51 18 -85 -36 -141 l-50 -52 0 144 c0 145 0 145 36 110 20 -18 42 -46 50 -61z m-568 -92 c45 -24 161 -149 172 -185 14 -48 -5 -84 -91 -169 -113 -113 -146 -112 -267 12 -79 81 -82 85 -82 131 0 44 4 51 68 117 102 107 141 125 200 94z"
      />
    </svg>
  )
}

export function HeroSection() {
  const sheet = useRef<HTMLElement>(null)
  useDevicePixel(sheet, "--hx-dp")

  return (
    <div className={styles.shell}>
      <section id="home" ref={sheet} className={styles.sheet} aria-labelledby="hero-name">
        {/* rails */}
        <div className={`${styles.box} ${styles.lrail}`} aria-hidden="true">
          <span className={styles.targetBox}>
            <Target />
          </span>
          <span className={styles.whiteBox} />
        </div>
        <div className={`${styles.box} ${styles.rrail}`} aria-hidden="true">
          <span className={styles.railBar} />
          <span className={styles.railMark}>
            <Cognition />
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
          <p className={styles.label}>
            <span className={styles.star} aria-hidden="true">
              ✳
            </span>
            Hey there, I’m
          </p>
          <span className={styles.asterisk} aria-hidden="true">
            ✳
          </span>
          <h1 id="hero-name" className={styles.name}>
            Martin Cam
          </h1>
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
        <div className={`${styles.box} ${styles.b1}`} aria-hidden="true">
          <span className={styles.miniGrid} />
          <span className={styles.pixel} />
        </div>
        <div className={`${styles.box} ${styles.b2}`}>
          <p className={styles.caption}>Ancient Paintings</p>
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
