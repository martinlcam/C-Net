"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  SiBun,
  SiDocker,
  SiExpress,
  SiNextdotjs,
  SiPostgresql,
  SiRadixui,
  SiReact,
  SiRedis,
  SiTailwindcss,
  SiTypescript,
  SiZod,
} from "react-icons/si"
import { TbDatabase } from "react-icons/tb"
import { takeFact, useFactTicker } from "@/lib/fact-ticker"

const techLogos = [
  { node: <SiReact />, title: "React", href: "https://react.dev" },
  { node: <SiNextdotjs />, title: "Next.js", href: "https://nextjs.org" },
  { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org" },
  { node: <SiTailwindcss />, title: "Tailwind CSS", href: "https://tailwindcss.com" },
  { node: <TbDatabase />, title: "Drizzle ORM", href: "https://orm.drizzle.team" },
  { node: <SiPostgresql />, title: "PostgreSQL", href: "https://www.postgresql.org" },
  { node: <SiRedis />, title: "Redis", href: "https://redis.io" },
  { node: <SiDocker />, title: "Docker", href: "https://www.docker.com" },
  { node: <SiExpress />, title: "Express.js", href: "https://expressjs.com" },
  { node: <SiRadixui />, title: "Radix UI", href: "https://www.radix-ui.com" },
  { node: <SiBun />, title: "Bun", href: "https://bun.sh" },
  { node: <SiZod />, title: "Zod", href: "https://zod.dev" },
]

/* pixels per second, the gap after each item, how quickly the stream eases
   to a stop under the pointer, and how far past the right edge it is kept
   filled: short, so a fact enters within a logo or two of being asked for */
const SPEED = 70
const GAP = 30
const SMOOTH_TAU = 0.25
const AHEAD = 40
const LOGOS_BETWEEN_FACTS = 3
const STILL_FACT_MS = 8000

type Item = { id: number; logo: number } | { id: number; fact: string }

const firstLogos: Item[] = techLogos.map((_, i) => ({ id: i, logo: i }))

type Props = {
  /** Icon size in px. */
  logoHeight?: number
  /** Background the edge fade blends into. */
  fadeOutColor?: string
}

/**
 * The scrolling tech-stack ticker: one endless stream, fed at its right end
 * and trimmed at its left. The logos take turns entering it, and when the
 * hero's target box has fetched a fact, the fact is simply the next thing to
 * enter, with the logos carrying on behind it. Icons inherit `currentColor`,
 * so the wrapper pins them to solid black wherever the ticker is mounted.
 */
export function TechTicker({ logoHeight = 18, fadeOutColor = "#ffffff" }: Props) {
  const strip = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<Item[]>(firstLogos)
  const [announced, setAnnounced] = useState("")
  const [stillFact, setStillFact] = useState<string | null>(null)
  const { waiting } = useFactTicker()

  const offset = useRef(0)
  const velocity = useRef(0)
  const hovered = useRef(false)
  const nextId = useRef(firstLogos.length)
  const nextLogo = useRef(0)
  const logosSinceFact = useRef(LOGOS_BETWEEN_FACTS)
  // the width trimmed off the left, owed to the offset once React has
  // removed the item, and whether such a change is still on its way
  const trimmed = useRef(0)
  const settling = useRef(false)

  // runs with the DOM change and before the paint, so the stream never jumps
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires on every change to the items
  useLayoutEffect(() => {
    offset.current -= trimmed.current
    trimmed.current = 0
    settling.current = false
    if (track.current) track.current.style.transform = `translate3d(${-offset.current}px, 0, 0)`
  }, [items])

  useEffect(() => {
    const stripEl = strip.current
    const trackEl = track.current
    if (!stripEl || !trackEl) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let frame = 0
    let last: number | null = null

    const step = (now: number) => {
      const dt = last === null ? 0 : Math.max(0, now - last) / 1000
      last = now
      const target = hovered.current ? 0 : SPEED
      velocity.current += (target - velocity.current) * (1 - Math.exp(-dt / SMOOTH_TAU))
      offset.current += velocity.current * dt

      if (!settling.current) {
        const first = trackEl.firstElementChild as HTMLElement | null
        const room = stripEl.clientWidth + AHEAD - (trackEl.offsetWidth - offset.current)

        if (first && first.offsetWidth + GAP <= offset.current) {
          trimmed.current = first.offsetWidth + GAP
          settling.current = true
          setItems((list) => list.slice(1))
        } else if (room > 0) {
          // facts asked for in a row still get a few logos between them
          const fact = logosSinceFact.current >= LOGOS_BETWEEN_FACTS ? takeFact() : undefined
          const added: Item[] = []
          if (fact !== undefined) {
            added.push({ id: nextId.current++, fact })
            logosSinceFact.current = 0
            setAnnounced(fact)
          } else {
            for (let i = 0; i < Math.ceil(room / (logoHeight + GAP)); i++) {
              added.push({ id: nextId.current++, logo: nextLogo.current++ % techLogos.length })
              logosSinceFact.current++
            }
          }
          settling.current = true
          setItems((list) => [...list, ...added])
        }
      }

      trackEl.style.transform = `translate3d(${-offset.current}px, 0, 0)`
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [logoHeight])

  // with motion reduced nothing streams, so a fact is held in the strip instead
  useEffect(() => {
    if (waiting === 0 || stillFact !== null) return
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const fact = takeFact()
    if (fact === undefined) return
    setStillFact(fact)
    setAnnounced(fact)
    const timer = window.setTimeout(() => setStillFact(null), STILL_FACT_MS)
    return () => window.clearTimeout(timer)
  }, [waiting, stillFact])

  const fade = `linear-gradient(to right, ${fadeOutColor} 0%, rgba(255,255,255,0) 100%)`

  return (
    <div
      ref={strip}
      className="relative h-full w-full overflow-hidden flex items-center text-black [&_svg]:text-black [&_svg]:fill-current"
      onPointerEnter={() => {
        hovered.current = true
      }}
      onPointerLeave={() => {
        hovered.current = false
      }}
    >
      {stillFact !== null ? (
        <p className="m-0 w-full truncate px-8 font-mono text-[12px] tracking-[0.04em]">
          {stillFact}
        </p>
      ) : (
        <div ref={track} className="flex w-max items-center will-change-transform">
          {items.map((item) =>
            "fact" in item ? (
              <span
                key={item.id}
                className="flex-none whitespace-nowrap font-mono text-[12px] leading-none tracking-[0.04em]"
                style={{ marginRight: GAP }}
              >
                {item.fact}
              </span>
            ) : (
              <a
                key={item.id}
                className="flex-none inline-flex items-center leading-none no-underline transition-opacity duration-200 hover:opacity-80"
                style={{ marginRight: GAP, fontSize: logoHeight }}
                href={techLogos[item.logo].href}
                title={techLogos[item.logo].title}
                aria-label={techLogos[item.logo].title}
                target="_blank"
                rel="noreferrer noopener"
              >
                {techLogos[item.logo].node}
              </a>
            )
          )}
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[clamp(24px,8%,120px)]"
        style={{ background: fade }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[clamp(24px,8%,120px)] rotate-180"
        style={{ background: fade }}
      />
      <span className="sr-only" aria-live="polite">
        {announced}
      </span>
    </div>
  )
}
