'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/stories/button/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/stories/card/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/stories/dropdown-menu/dropdown-menu'

export default function HomePage() {
  const { data: session, status } = useSession()

  const projects = [
    {
      id: 1,
      title: 'C-Net Dashboard',
      description:
        'A comprehensive homelab dashboard for managing VMs, containers, and services. Features real-time monitoring, service management, and infrastructure control.',
      technologies: ['Next.js 16', 'React 19', 'TypeScript', 'Drizzle ORM', 'Proxmox', 'Redis'],
      github: 'https://github.com/yourusername/c-net',
      demo: '/cnet/dashboard',
    },
    {
      id: 2,
      title: 'Project 2',
      description: 'Description of your second project.',
      technologies: ['Tech 1', 'Tech 2', 'Tech 3'],
      github: '#',
      demo: '#',
    },
    {
      id: 3,
      title: 'Project 3',
      description: 'Description of your third project.',
      technologies: ['Tech 1', 'Tech 2'],
      github: '#',
      demo: '#',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* ===== MAIN FRAMED LAYOUT ===== */}
      <div className="border border-black">
        
        {/* ===== TOP SECTION: CNET sidebar + Main content area ===== */}
        <div className="flex">
          {/* Left sidebar with C-N-E-T - extends full height of hero */}
          <div className="w-[58px] border-r border-black flex flex-col items-center pt-6 shrink-0">
            <div className="flex flex-col items-center text-[48px] font-normal text-black leading-none tracking-tight" style={{ fontFamily: 'var(--font-sans), sans-serif' }}>
              <span>C</span>
              <span>N</span>
              <span>E</span>
              <span>T</span>
            </div>
          </div>
          
          {/* Right side - Header + Hero content */}
          <div className="flex-1 flex flex-col">
            {/* Header row */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black">
              {/* Left Navigation */}
              <nav className="flex items-center gap-6">
                <a href="#home" className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors">
                  Home
                </a>
                <a href="#about" className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors">
                  About
                </a>
                <a href="#projects" className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors">
                  Projects
                </a>
                <a href="#contact" className="text-[24px] font-normal text-black hover:text-gray-600 transition-colors">
                  Contact
                </a>
              </nav>

              {/* Right side - Auth */}
              <div className="flex items-center gap-4">
                {status === 'loading' ? (
                  <div className="h-12 w-24 bg-gray-100 animate-pulse rounded-xl" />
                ) : session ? (
                  <>
                    <Button asChild variant="outline" className="rounded-[12px] border-[#ddc9f7] text-[#ad70eb] hover:bg-purple-50 px-7 py-3.5 h-12 text-lg font-medium">
                      <Link href="/cnet/dashboard">C-Net</Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
                            {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <div className="px-2 py-1.5">
                          <p className="text-sm font-medium text-black">
                            {session.user?.name || 'User'}
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
                  <Button asChild variant="outline" className="rounded-[12px] border-[#ddc9f7] text-[#ad70eb] hover:bg-purple-50 px-7 py-3.5 h-12 text-lg font-medium">
                    <Link href="/auth/signin">Sign In</Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Hero Section - with decorative background */}
            <section id="home" className="relative min-h-[500px] flex items-center px-10 py-16 overflow-hidden">
              {/* Decorative vector lines background */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 1400 600"
                fill="none"
                preserveAspectRatio="xMidYMid slice"
              >
                <path
                  d="M-100 100 Q 200 50, 400 150 T 800 100 T 1200 200 T 1600 100"
                  stroke="#e5e5e5"
                  strokeWidth="1"
                  fill="none"
                />
                <path
                  d="M-100 200 Q 300 150, 500 250 T 900 200 T 1300 300 T 1600 200"
                  stroke="#e5e5e5"
                  strokeWidth="1"
                  fill="none"
                />
                <path
                  d="M-100 300 Q 250 250, 450 350 T 850 300 T 1250 400 T 1600 300"
                  stroke="#e5e5e5"
                  strokeWidth="1"
                  fill="none"
                />
                <path
                  d="M-100 400 Q 200 350, 400 450 T 800 400 T 1200 500 T 1600 400"
                  stroke="#e5e5e5"
                  strokeWidth="1"
                  fill="none"
                />
                <path
                  d="M-100 500 Q 300 450, 500 550 T 900 500 T 1300 600 T 1600 500"
                  stroke="#e5e5e5"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>

              {/* Hero content */}
              <div className="relative z-10 max-w-[600px]">
                <p className="text-gray-500 text-base mb-2">Hey there, I'm</p>
                <h1 className="text-[64px] font-bold text-black mb-6 tracking-tight leading-none">
                  Martin Cam<span className="inline-block ml-2 w-3 h-3 rounded-full bg-[#22c55e] align-middle" />
                </h1>
                <p className="text-base text-gray-700 mb-4 leading-relaxed">
                  An 19-year-old Full Stack web developer based in{' '}
                  <span className="text-[#22c55e] font-medium">Vancouver, Canada</span>.
                  I'm currently working as a{' '}
                  <span className="text-[#22c55e] font-medium">Software Engineer at Futurity</span>,
                  an international AI startup providing enterprise on-premise AI deployments, integrations
                  and plugins for clients around the world.
                </p>
                <p className="text-base text-gray-700 mb-8 leading-relaxed">
                  Primarily, I write a lot of TypeScript, React, Next, and Tailwind CSS but I
                  also have experience with ExpressJS, Drizzle ORM, PostgreSQL, and Docker.
                </p>
                <div className="flex gap-3">
                  <Button asChild className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-[12px] text-base font-medium h-auto">
                    <a href="#projects">View Projects</a>
                  </Button>
                  <Button asChild variant="outline" className="border-black text-black hover:bg-gray-100 px-6 py-3 rounded-[12px] text-base font-medium h-auto">
                    <a href="#contact">Get in Touch</a>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ===== HORIZONTAL LINE - End of hero section ===== */}
        <div className="border-t border-black" />

        {/* ===== THIN STRIP SECTION - Decorative bar ===== */}
        <div className="h-10 border-b border-black" />

        {/* ===== REST OF PAGE - About, Projects, Contact ===== */}
        <div>
          {/* ===== ABOUT SECTION ===== */}
          <section id="about" className="py-24 px-12 lg:px-20 border-b border-black">
            <div className="max-w-5xl">
              <h2 className="text-5xl md:text-6xl font-bold text-black mb-12 tracking-tight">
                About<span className="text-green-500">.</span>
              </h2>

              <div className="grid md:grid-cols-2 gap-12 mb-16">
                <div>
                  <h3 className="text-2xl font-semibold text-black mb-4">Personal Bio</h3>
                  <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                    I'm a full-stack developer passionate about building modern web applications and
                    managing infrastructure. I enjoy working with cutting-edge technologies and solving
                    complex problems.
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

              <div>
                <h3 className="text-2xl font-semibold text-black mb-6">Technologies</h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    'Next.js 16',
                    'React 19',
                    'TypeScript',
                    'Tailwind CSS',
                    'Drizzle ORM',
                    'PostgreSQL',
                    'Redis',
                    'BullMQ',
                    'Auth.js',
                    'TanStack Query',
                    'Zustand',
                    'Radix UI',
                    'Proxmox',
                    'Bun',
                  ].map((tech) => (
                    <span
                      key={tech}
                      className="px-4 py-2 bg-gray-100 text-gray-800 border border-black text-sm font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ===== PROJECTS SECTION ===== */}
          <section id="projects" className="py-24 px-12 lg:px-20 border-b border-black">
            <div className="max-w-7xl">
              <h2 className="text-5xl md:text-6xl font-bold text-black mb-4 tracking-tight">
                Projects<span className="text-green-500">.</span>
              </h2>
              <p className="text-xl text-gray-600 mb-12 max-w-2xl">
                A collection of projects showcasing my work in full-stack development, infrastructure
                management, and modern web technologies.
              </p>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="flex flex-col border-black">
                    <CardHeader>
                      <CardTitle className="text-black">{project.title}</CardTitle>
                      <CardDescription className="text-gray-600">{project.description}</CardDescription>
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
                      <Button asChild variant="outline" size="sm" className="border-black text-black">
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

          {/* ===== CONTACT SECTION ===== */}
          <section id="contact" className="py-24 px-12 lg:px-20 border-b border-black">
            <div className="max-w-4xl">
              <h2 className="text-5xl md:text-6xl font-bold text-black mb-4 tracking-tight">
                Contact<span className="text-green-500">.</span>
              </h2>
              <p className="text-xl text-gray-600 mb-12">
                Get in touch with me for collaborations, opportunities, or just to say hello!
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <a
                  href="mailto:your.email@example.com"
                  className="p-6 border border-black group"
                >
                  <h3 className="text-lg font-semibold text-black mb-2 group-hover:text-green-600">
                    Email
                  </h3>
                  <p className="text-gray-600">your.email@example.com</p>
                </a>

                <a
                  href="https://github.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 border border-black group"
                >
                  <h3 className="text-lg font-semibold text-black mb-2 group-hover:text-green-600">
                    GitHub
                  </h3>
                  <p className="text-gray-600">github.com/yourusername</p>
                </a>

                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 border border-black group"
                >
                  <h3 className="text-lg font-semibold text-black mb-2 group-hover:text-green-600">
                    LinkedIn
                  </h3>
                  <p className="text-gray-600">linkedin.com/in/yourprofile</p>
                </a>

                <a
                  href="https://twitter.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 border border-black group"
                >
                  <h3 className="text-lg font-semibold text-black mb-2 group-hover:text-green-600">
                    Twitter
                  </h3>
                  <p className="text-gray-600">@yourusername</p>
                </a>
              </div>

              <div className="p-8 border border-black bg-gray-50">
                <h3 className="text-2xl font-semibold text-black mb-3">
                  Let's Work Together
                </h3>
                <p className="text-gray-600 mb-6">
                  I'm always interested in new projects and opportunities. Feel free to reach out!
                </p>
                <Button asChild size="lg" className="bg-black hover:bg-gray-800 text-white">
                  <a href="mailto:your.email@example.com">Send an Email</a>
                </Button>
              </div>
            </div>
          </section>

          {/* Footer */}
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
