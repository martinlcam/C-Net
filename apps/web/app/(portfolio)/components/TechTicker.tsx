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
 */
export function TechTicker({ logoHeight = 18, fadeOutColor = "#ffffff" }: Props) {
  return (
    <div className="h-full w-full flex items-center text-black [&_svg]:text-black [&_svg]:fill-current">
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
    </div>
  )
}
