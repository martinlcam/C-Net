"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { animate, svg, stagger } from "animejs"
import { Button } from "@/stories/button/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/stories/card/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/stories/dropdown-menu/dropdown-menu"
import LogoLoop from "@/components/LogoLoop"
import { AuthModal } from "@/components/AuthModal"
import { useAuthModal } from "@/lib/stores/auth-modal"
import { Text } from "@radix-ui/themes"
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

function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus("idle")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        setSubmitStatus("success")
        setFormData({ name: "", email: "", message: "" })
      } else {
        setSubmitStatus("error")
      }
    } catch {
      setSubmitStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contact" className="py-24 px-12 lg:px-20 border-b border-black">
      <div className="max-w-5xl">
        <div className="flex flex-col md:flex-row md:gap-0">
          {/* Left side - Get in Touch info */}
          <div className="md:w-2/5 md:pr-12 pb-8 md:pb-0">
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-4 tracking-tight">
              Get in Touch
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              I'm looking forward to hearing from you! If you prefer not to fill out forms, feel
              free to email me directly.
            </p>
            <a
              href="mailto:martin@futurity.work"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-black underline hover:text-gray-600 transition-colors"
            >
              martin@futurity.work
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
          </div>

          {/* Divider - horizontal on mobile, vertical on desktop */}
          <div className="border-t md:border-t-0 md:border-l border-black my-0 md:my-0" />

          {/* Right side - Form */}
          <div className="md:w-3/5 md:pl-12 pt-8 md:pt-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="name" className="text-sm font-medium text-black">
                    Name <span className="text-gray-400">*</span>
                  </label>
                  <span className="text-sm text-gray-400">{formData.name.length}/100</span>
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex. Toby Fox"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="email" className="text-sm font-medium text-black">
                    Email <span className="text-gray-400">*</span>
                  </label>
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="waddle-doo@website.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="message" className="text-sm font-medium text-black">
                    Share More Details <span className="text-gray-400">*</span>
                  </label>
                  <span className="text-sm text-gray-400">{formData.message.length}/5000</span>
                </div>
                <textarea
                  id="message"
                  name="message"
                  required
                  maxLength={5000}
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe what you need..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#bea9e9] focus:border-transparent transition-all resize-none"
                />
              </div>

              {submitStatus === "success" && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 text-sm">
                    Message sent successfully! I'll get back to you soon.
                  </p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">
                    Something went wrong. Please try again or email me directly.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-gray-800 text-white py-4 rounded-lg text-base font-medium h-auto disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : "Submit"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

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

export default function HomePage() {
  const { data: session, status } = useSession()
  const { openModal } = useAuthModal()
  const svgRef = useRef<SVGSVGElement>(null)
  const [isAtTop, setIsAtTop] = useState(true)

  useEffect(() => {
    if (svgRef.current) {
      animate(svg.createDrawable('.hero-line'), {
        draw: ['0 0', '0 1'],
        ease: 'outInSine',
        duration: 1000,
        delay: stagger(100),
        loop: false
      })
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => setIsAtTop(window.scrollY === 0)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const projects = [
    {
      id: 1,
      title: "C-Net Dashboard",
      description:
        "A comprehensive homelab dashboard for managing VMs, containers, and services. Features real-time monitoring, service management, and infrastructure control.",
      technologies: ["Next.js 16", "React 19", "TypeScript", "Drizzle ORM", "Proxmox", "Redis"],
      github: "https://github.com/yourusername/c-net",
      demo: "/cnet/dashboard",
    },
    {
      id: 2,
      title: "Project 2",
      description: "Description of your second project.",
      technologies: ["Tech 1", "Tech 2", "Tech 3"],
      github: "#",
      demo: "#",
    },
    {
      id: 3,
      title: "Project 3",
      description: "Description of your third project.",
      technologies: ["Tech 1", "Tech 2"],
      github: "#",
      demo: "#",
    },
  ]

  return (
    <div className="min-h-screen w-full bg-[#eef1f0]">
      <AuthModal />
      <div className="border-y border-l border-black">
        <div className="flex border-b border-black sticky top-0 z-50 bg-[#eef1f0]">
          {/* Conditionally show border when at page top */}
          <div className={`w-[58px] h-16 flex items-center justify-center shrink-0 transition-all ${isAtTop ? 'border-r border-black' : ''}`}></div>
          <div className="flex-1 flex items-center justify-between px-6">
            <nav className="flex items-center gap-6">
              <a
                href="#home"
                className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors"
              >
                Home
              </a>
              <a
                href="#about"
                className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors"
              >
                About
              </a>
              <a
                href="#projects"
                className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors"
              >
                Projects
              </a>
              <a
                href="#contact"
                className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors"
              >
                Contact
              </a>
            </nav>
            <div className="flex items-center gap-4">
              {status === "loading" ? (
                <div className="h-12 w-24 bg-gray-100 animate-pulse rounded-xl" />
              ) : session ? (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-[12px] border-[#ddc9f7] text-[#ad70eb] hover:bg-purple-50 px-7 py-3.5 h-12 text-lg font-medium"
                  >
                    <Link href="/cnet/dashboard">C-Net</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
                          {session.user?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-2 py-1.5">
                        <p className="text-sm font-medium text-black">
                          {session.user?.name || "User"}
                        </p>
                        <p className="text-xs text-gray-600">{session.user?.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/cnet/dashboard">Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => signOut()}>Sign Out</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button
                  onClick={openModal}
                  variant="outline"
                  className="rounded-[12px] border-black text-black hover:bg-gray-100 px-7 py-3.5 h-12 text-lg font-medium"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex">
          <div className="w-[58px] border-r border-black flex flex-col items-center pt-2 shrink-0">
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
            className="flex-1 relative min-h-[70vh] flex items-center px-10 py-16 overflow-hidden"
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
              <p className="text-gray-500 text-xl mb-3">Hey there, I'm</p>
              <h1 className="text-[80px] md:text-[96px] font-bold text-black mb-8 tracking-tight leading-none">
                Martin Cam
                <span className="inline-block ml-3 w-4 h-4 rounded-full bg-[#bea9e9] relative -top-14" />
              </h1>
              <p className="text-xl text-gray-700 mb-5 leading-relaxed">
                An 19-year-old Full Stack web developer based in{" "}
                <Text color="iris">Vancouver, Canada</Text>. I'm currently working as a{" "}
                <a
                  href="https://futurity.work"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  <Text color="grass">Software Engineer at Futurity</Text>
                </a>
                , an international AI startup providing enterprise on-premise AI deployments,
                integrations and plugins for clients around the world.
              </p>
              <p className="text-xl text-gray-700 mb-10 leading-relaxed">
                Primarily, I write a lot of TypeScript, React, Next, and Tailwind CSS but I also
                have experience with ExpressJS, Drizzle ORM, PostgreSQL, and Docker.
              </p>
              <div className="flex gap-4">
                <Button
                  asChild
                  className="bg-black hover:bg-gray-800 text-white px-8 py-4 rounded-[12px] text-lg font-medium h-auto"
                >
                  <a href="#projects">View Projects</a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-black text-black hover:bg-gray-100 px-8 py-4 rounded-[12px] text-lg font-medium h-auto"
                >
                  <a href="#contact">Get in Touch</a>
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-black" />

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
            fadeOutColor="#eef1f0"
            ariaLabel="Technologies used"
          />
        </div>

        <div>
          <section id="about" className="py-24 px-12 lg:px-20 border-b border-black">
            <div className="max-w-5xl">
              <h2 className="text-5xl md:text-6xl font-bold text-black mb-12 tracking-tight">
                About<span className="text-[#bea9e9]">.</span>
              </h2>

              <div className="grid md:grid-cols-2 gap-12 mb-16">
                <div>
                  <h3 className="text-2xl font-semibold text-black mb-4">Personal Bio</h3>
                  <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                    I'm a full-stack developer passionate about building modern web applications and
                    managing infrastructure. I enjoy working with cutting-edge technologies and
                    solving complex problems.
                  </p>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    My expertise spans frontend and backend development, with a focus on creating
                    scalable, maintainable applications. I'm particularly interested in homelab
                    infrastructure management and DevOps practices.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 border border-black">
                    <h4 className="text-lg font-semibold text-black mb-3">Frontend</h4>
                    <ul className="text-gray-600 space-y-1.5 text-sm">
                      <li>React & Next.js</li>
                      <li>TypeScript</li>
                      <li>Tailwind CSS</li>
                      <li>TanStack Query</li>
                      <li>Zustand</li>
                    </ul>
                  </div>
                  <div className="p-6 border border-black">
                    <h4 className="text-lg font-semibold text-black mb-3">Backend</h4>
                    <ul className="text-gray-600 space-y-1.5 text-sm">
                      <li>Node.js & Express</li>
                      <li>PostgreSQL</li>
                      <li>Drizzle ORM</li>
                      <li>Redis & BullMQ</li>
                      <li>REST APIs</li>
                    </ul>
                  </div>
                  <div className="p-6 border border-black">
                    <h4 className="text-lg font-semibold text-black mb-3">Infrastructure</h4>
                    <ul className="text-gray-600 space-y-1.5 text-sm">
                      <li>Proxmox</li>
                      <li>Docker</li>
                      <li>Linux Admin</li>
                      <li>CI/CD</li>
                      <li>Monitoring</li>
                    </ul>
                  </div>
                  <div className="p-6 border border-black">
                    <h4 className="text-lg font-semibold text-black mb-3">Tools</h4>
                    <ul className="text-gray-600 space-y-1.5 text-sm">
                      <li>Git & GitHub</li>
                      <li>Biome</li>
                      <li>TypeScript Strict</li>
                      <li>Bun Runtime</li>
                      <li>VS Code</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="projects" className="py-24 px-12 lg:px-20 border-b border-black">
            <div className="max-w-7xl">
              <h2 className="text-5xl md:text-6xl font-bold text-black mb-4 tracking-tight">
                Projects<span className="text-[#bea9e9]">.</span>
              </h2>
              <p className="text-xl text-gray-600 mb-12 max-w-2xl">
                A collection of projects showcasing my work in full-stack development,
                infrastructure management, and modern web technologies.
              </p>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="flex flex-col border-black">
                    <CardHeader>
                      <CardTitle className="text-black">{project.title}</CardTitle>
                      <CardDescription className="text-gray-600">
                        {project.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-300 text-xs"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-black text-black"
                      >
                        <Link href={project.github} target="_blank" rel="noopener noreferrer">
                          GitHub
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="bg-black hover:bg-gray-800">
                        <Link href={project.demo}>Demo</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <ContactSection />

          <footer className="py-8 px-12 lg:px-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">
                © {new Date().getFullYear()} Martin Cam. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a
                  href="https://github.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-black text-sm"
                >
                  GitHub
                </a>
                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-black text-sm"
                >
                  LinkedIn
                </a>
                <a
                  href="https://twitter.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-black text-sm"
                >
                  Twitter
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
