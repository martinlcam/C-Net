"use client"

import { Text } from "@radix-ui/themes"
import { animate, stagger, svg } from "animejs"
import { type RefObject, useEffect, useRef } from "react"
import { useDevicePixel } from "@/lib/use-device-pixel"
import { useDrawIn } from "@/lib/use-draw-in"
import { Cognition, Consciousness } from "../components/symbols"
import styles from "./HeroSection.module.css"

const SVG = "http://www.w3.org/2000/svg"

/*
 * The sheet draws itself in. Its lines are css (grid gaps, borders and
 * pseudo-elements), so they are measured from the boxes and traced on an svg
 * overlay while the real lines are held clear by the drawing class; when the
 * trace ends the real lines take over and the overlay is emptied. Readers who
 * prefer less motion get the sheet whole.
 */
function useDrawSheet(
  sheet: RefObject<HTMLElement | null>,
  overlay: RefObject<SVGSVGElement | null>
) {
  useEffect(() => {
    const root = sheet.current
    const canvas = overlay.current
    if (!root || !canvas) return

    const settle = () => {
      root.classList.remove(styles.drawing)
      canvas.replaceChildren()
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settle()
      return
    }

    const style = getComputedStyle(root)
    const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0
    const dp = px("--hx-dp") || 1
    const half = dp / 2
    const origin = root.getBoundingClientRect()
    const shapes: SVGGeometryElement[] = []

    const rectOf = (el: Element) => {
      const r = el.getBoundingClientRect()
      return {
        l: r.left - origin.left,
        t: r.top - origin.top,
        r: r.right - origin.left,
        b: r.bottom - origin.top,
      }
    }
    const add = (tag: "rect" | "line" | "polyline", attrs: Record<string, number | string>) => {
      const shape = document.createElementNS(SVG, tag)
      for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, String(value))
      canvas.append(shape)
      shapes.push(shape as SVGGeometryElement)
    }
    const box = (l: number, t: number, r: number, b: number) =>
      add("rect", { x: l, y: t, width: r - l, height: b - t })
    const line = (x1: number, y1: number, x2: number, y2: number, slant = false) =>
      add(
        "line",
        slant ? { x1, y1, x2, y2, "shape-rendering": "geometricPrecision" } : { x1, y1, x2, y2 }
      )
    const boxes = (name: string) =>
      Array.from(root.querySelectorAll(`.${name}`))
        .map(rectOf)
        .filter((r) => r.r > r.l && r.b > r.t)
    const one = (name: string) => boxes(name)[0]

    // grid boxes: the lines are the gaps around them, one device pixel outside
    for (const r of boxes(styles.box)) box(r.l - half, r.t - half, r.r + half, r.b + half)

    // the rail's enclosed boxes: their borders lie inside their edges
    for (const name of [styles.targetBox, styles.lowerBox]) {
      const r = one(name)
      if (r) box(r.l + half, r.t + half, r.r - half, r.b - half)
    }
    // the bar and the mark have no left border; the rail's own line is theirs
    for (const name of [styles.railBar, styles.railMark]) {
      const r = one(name)
      if (r)
        add("polyline", {
          points: `${r.l - half},${r.t + half} ${r.r - half},${r.t + half} ${r.r - half},${r.b - half} ${r.l - half},${r.b - half}`,
        })
    }

    // the loose hairlines: the middle box's cut, the fine grid's top, the
    // panel's bottom and chamfer, the fourth box's top and chamfer
    const cut = px("--hx-cut")
    const mid = one(styles.mid)
    if (mid) {
      const y = mid.t + (mid.b - mid.t) * 0.55 + half
      line(mid.l, y, mid.r, y)
    }
    const grid = one(styles.miniGrid)
    if (grid) line(grid.l, grid.t + half, grid.r, grid.t + half)
    const panel = one(styles.panelWrap)
    if (panel) {
      line(panel.l, panel.b - half, panel.r - cut, panel.b - half)
      line(panel.r - cut, panel.b, panel.r, panel.b - cut, true)
    }
    const b4 = one(styles.b4)
    const b4top = one(styles.b4top)
    if (b4 && b4top) {
      const w = b4.r - b4.l
      line(b4top.l, b4top.t + half, b4top.l + w - cut, b4top.t + half)
      line(b4top.l + w - cut, b4top.t, b4top.l + w, b4top.t + cut, true)
    }

    // the column lines' reach up into the masthead
    const reach = px("--hx-reach")
    for (const name of [styles.t1, styles.t2, styles.t3, styles.t4]) {
      const r = one(name)
      if (r && reach) line(r.r + half, r.t - reach, r.r + half, r.t)
    }
    const rail = one(styles.lrail)
    const reachLeft = px("--hx-reach-left")
    if (rail && reachLeft) line(rail.r + half, rail.t - reachLeft, rail.r + half, rail.t)

    const drawing = animate(svg.createDrawable(shapes), {
      draw: ["0 0", "0 1"],
      ease: "inOutQuad",
      duration: 900,
      delay: stagger(45),
      onComplete: settle,
    })

    return () => {
      drawing.revert()
    }
  }, [sheet, overlay])
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
  const lines = useRef<SVGSVGElement>(null)
  const symbols = useRef<HTMLDivElement>(null)
  useDevicePixel(sheet, "--hx-dp")
  useDrawSheet(sheet, lines)
  useDrawIn(symbols, { fill: true })

  return (
    <div className={styles.shell}>
      <section
        id="home"
        ref={sheet}
        className={`${styles.sheet} ${styles.drawing}`}
        aria-labelledby="hero-name"
      >
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

        {/* the overlay the sheet draws itself in on */}
        <svg ref={lines} className={styles.lines} aria-hidden="true" />
      </section>
    </div>
  )
}
