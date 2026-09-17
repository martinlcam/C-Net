"use client"

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
import LogoLoop from "@/components/LogoLoop"
import { clearFact, useFactTicker } from "@/lib/fact-ticker"
import { FactTicker } from "./FactTicker"

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

type Props = {
  /** Icon size in px. */
  logoHeight?: number
  /** Background the edge fade blends into. */
  fadeOutColor?: string
}

/**
 * The scrolling tech-stack ticker. Icons inherit `currentColor`, so the
 * wrapper pins them to solid black regardless of where the ticker is mounted.
 * When the hero's target box has asked for a fact, the fact runs across the
 * strip once in the logos' place, and the logos return after it.
 */
export function TechTicker({ logoHeight = 18, fadeOutColor = "#ffffff" }: Props) {
  const { fact } = useFactTicker()

  return (
    <div className="h-full w-full flex items-center text-black [&_svg]:text-black [&_svg]:fill-current">
      {fact ? (
        <FactTicker key={fact.text} fact={fact} onDone={clearFact} />
      ) : (
        <LogoLoop
          logos={techLogos}
          speed={70}
          direction="left"
          logoHeight={logoHeight}
          gap={30}
          hoverSpeed={0}
          fadeOut
          fadeOutColor={fadeOutColor}
          ariaLabel="Technologies used"
        />
      )}
    </div>
  )
}
