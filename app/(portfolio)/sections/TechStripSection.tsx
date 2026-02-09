"use client"

import {
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
  SiPostgresql,
  SiRedis,
  SiDocker,
  SiExpress,
  SiRadixui,
  SiBun,
  SiZod,
} from "react-icons/si"
import { TbDatabase } from "react-icons/tb"
import LogoLoop from "@/components/LogoLoop"

const techLogos = [
  { node: <SiReact className="text-black" />, title: "React", href: "https://react.dev" },
  { node: <SiNextdotjs className="text-black" />, title: "Next.js", href: "https://nextjs.org" },
  {
    node: <SiTypescript className="text-black" />,
    title: "TypeScript",
    href: "https://www.typescriptlang.org",
  },
  {
    node: <SiTailwindcss className="text-black" />,
    title: "Tailwind CSS",
    href: "https://tailwindcss.com",
  },
  {
    node: <TbDatabase className="text-black" />,
    title: "Drizzle ORM",
    href: "https://orm.drizzle.team",
  },
  {
    node: <SiPostgresql className="text-black" />,
    title: "PostgreSQL",
    href: "https://www.postgresql.org",
  },
  { node: <SiRedis className="text-black" />, title: "Redis", href: "https://redis.io" },
  { node: <SiDocker className="text-black" />, title: "Docker", href: "https://www.docker.com" },
  {
    node: <SiExpress className="text-black" />,
    title: "Express.js",
    href: "https://expressjs.com",
  },
  {
    node: <SiRadixui className="text-black" />,
    title: "Radix UI",
    href: "https://www.radix-ui.com",
  },
  { node: <SiBun className="text-black" />, title: "Bun", href: "https://bun.sh" },
  { node: <SiZod className="text-black" />, title: "Zod", href: "https://zod.dev" },
]

export function TechStripSection() {
  return (
    <div className="h-[10vh] border-b border-black flex items-center overflow-hidden">
      <LogoLoop
        logos={techLogos}
        speed={80}
        direction="left"
        logoHeight={32}
        gap={48}
        hoverSpeed={0}
        scaleOnHover
        fadeOut
        fadeOutColor="#faf6f1"
        ariaLabel="Technologies used"
      />
    </div>
  )
}
