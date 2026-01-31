import Link from 'next/link'
import { Button } from '@/stories/button/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/stories/card/card'

export default function HomePage() {
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
      {/* Left border line */}
      <div className="fixed left-0 top-0 bottom-0 w-12 z-40 bg-white border-r border-neutral-30 flex flex-col items-center justify-center">
        <span className="text-xs font-medium text-neutral-50 tracking-widest rotate-180 [writing-mode:vertical-lr]">
          PORTFOLIO
        </span>
      </div>

      {/* Main content with left margin for the border */}
      <main className="ml-12">
        {/* ===== HOME SECTION ===== */}
        <section id="home" className="min-h-screen flex items-center pt-16">
          <div className="w-full px-8 lg:px-16 py-20">
            <div className="max-w-4xl">
              <p className="text-neutral-60 text-lg mb-2">Hey there, I'm</p>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-neutral-100 mb-6 tracking-tight">
                Martin Cam<span className="text-accent-green-50 inline-block ml-2 w-4 h-4 rounded-full bg-accent-green-50 align-middle" />
              </h1>
              <p className="text-lg md:text-xl text-neutral-70 mb-6 max-w-2xl leading-relaxed">
                An 19-year-old Full Stack web developer based in{' '}
                <span className="text-accent-green-60 font-medium">Vancouver, Canada</span>.
                I'm currently working as a{' '}
                <span className="text-accent-green-60 font-medium">Software Engineer at Futurity</span>,
                an international AI startup providing enterprise on-premise AI deployments, integrations
                and plugins for clients around the world.
              </p>
              <p className="text-lg md:text-xl text-neutral-70 mb-10 max-w-2xl leading-relaxed">
                Primarily, I write a lot of TypeScript, React, Next, and Tailwind CSS but I
                also have experience with ExpressJS, Drizzle ORM, PostgreSQL, and Docker.
              </p>
              <div className="flex gap-4">
                <Button asChild size="lg" className="bg-neutral-100 hover:bg-neutral-80 text-white px-8">
                  <Link href="#projects">View Projects</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-neutral-100 text-neutral-100 hover:bg-neutral-100 hover:text-white px-8">
                  <Link href="#contact">Get in Touch</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== ABOUT SECTION ===== */}
        <section id="about" className="min-h-screen py-20 border-t border-neutral-30">
          <div className="px-8 lg:px-16">
            <div className="max-w-5xl">
              <h2 className="text-5xl md:text-6xl font-bold text-neutral-100 mb-12 tracking-tight">
                About<span className="text-accent-green-50">.</span>
              </h2>

              <div className="grid md:grid-cols-2 gap-12 mb-16">
                <div>
                  <h3 className="text-2xl font-semibold text-neutral-100 mb-4">Personal Bio</h3>
                  <p className="text-lg text-neutral-70 mb-4 leading-relaxed">
                    I'm a full-stack developer passionate about building modern web applications and
                    managing infrastructure. I enjoy working with cutting-edge technologies and solving
                    complex problems.
                  </p>
                  <p className="text-lg text-neutral-70 leading-relaxed">
                    My expertise spans frontend and backend development, with a focus on creating
                    scalable, maintainable applications. I'm particularly interested in homelab
                    infrastructure management and DevOps practices.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 border border-neutral-30 rounded-lg">
                    <h4 className="text-lg font-semibold text-neutral-100 mb-3">Frontend</h4>
                    <ul className="text-neutral-60 space-y-1.5 text-sm">
                      <li>React & Next.js</li>
                      <li>TypeScript</li>
                      <li>Tailwind CSS</li>
                      <li>TanStack Query</li>
                      <li>Zustand</li>
                    </ul>
                  </div>
                  <div className="p-6 border border-neutral-30 rounded-lg">
                    <h4 className="text-lg font-semibold text-neutral-100 mb-3">Backend</h4>
                    <ul className="text-neutral-60 space-y-1.5 text-sm">
                      <li>Node.js & Express</li>
                      <li>PostgreSQL</li>
                      <li>Drizzle ORM</li>
                      <li>Redis & BullMQ</li>
                      <li>REST APIs</li>
                    </ul>
                  </div>
                  <div className="p-6 border border-neutral-30 rounded-lg">
                    <h4 className="text-lg font-semibold text-neutral-100 mb-3">Infrastructure</h4>
                    <ul className="text-neutral-60 space-y-1.5 text-sm">
                      <li>Proxmox</li>
                      <li>Docker</li>
                      <li>Linux Admin</li>
                      <li>CI/CD</li>
                      <li>Monitoring</li>
                    </ul>
                  </div>
                  <div className="p-6 border border-neutral-30 rounded-lg">
                    <h4 className="text-lg font-semibold text-neutral-100 mb-3">Tools</h4>
                    <ul className="text-neutral-60 space-y-1.5 text-sm">
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
                <h3 className="text-2xl font-semibold text-neutral-100 mb-6">Technologies</h3>
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
                      className="px-4 py-2 bg-neutral-10 text-neutral-70 border border-neutral-30 rounded-full text-sm font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PROJECTS SECTION ===== */}
        <section id="projects" className="min-h-screen py-20 border-t border-neutral-30">
          <div className="px-8 lg:px-16">
            <div className="max-w-7xl">
              <h2 className="text-5xl md:text-6xl font-bold text-neutral-100 mb-4 tracking-tight">
                Projects<span className="text-accent-green-50">.</span>
              </h2>
              <p className="text-xl text-neutral-60 mb-12 max-w-2xl">
                A collection of projects showcasing my work in full-stack development, infrastructure
                management, and modern web technologies.
              </p>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="flex flex-col border-neutral-30 hover:border-neutral-50 transition-colors">
                    <CardHeader>
                      <CardTitle className="text-neutral-100">{project.title}</CardTitle>
                      <CardDescription className="text-neutral-60">{project.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="px-2 py-1 bg-neutral-10 text-neutral-60 border border-neutral-30 rounded text-xs"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="border-neutral-30 text-neutral-70">
                        <Link href={project.github} target="_blank" rel="noopener noreferrer">
                          GitHub
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="bg-neutral-100 hover:bg-neutral-80">
                        <Link href={project.demo}>Demo</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== CONTACT SECTION ===== */}
        <section id="contact" className="min-h-screen py-20 border-t border-neutral-30">
          <div className="px-8 lg:px-16">
            <div className="max-w-4xl">
              <h2 className="text-5xl md:text-6xl font-bold text-neutral-100 mb-4 tracking-tight">
                Contact<span className="text-accent-green-50">.</span>
              </h2>
              <p className="text-xl text-neutral-60 mb-12">
                Get in touch with me for collaborations, opportunities, or just to say hello!
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <a
                  href="mailto:your.email@example.com"
                  className="p-6 border border-neutral-30 rounded-lg hover:border-neutral-50 transition-colors group"
                >
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2 group-hover:text-accent-green-60 transition-colors">
                    Email
                  </h3>
                  <p className="text-neutral-60">your.email@example.com</p>
                </a>

                <a
                  href="https://github.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 border border-neutral-30 rounded-lg hover:border-neutral-50 transition-colors group"
                >
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2 group-hover:text-accent-green-60 transition-colors">
                    GitHub
                  </h3>
                  <p className="text-neutral-60">github.com/yourusername</p>
                </a>

                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 border border-neutral-30 rounded-lg hover:border-neutral-50 transition-colors group"
                >
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2 group-hover:text-accent-green-60 transition-colors">
                    LinkedIn
                  </h3>
                  <p className="text-neutral-60">linkedin.com/in/yourprofile</p>
                </a>

                <a
                  href="https://twitter.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 border border-neutral-30 rounded-lg hover:border-neutral-50 transition-colors group"
                >
                  <h3 className="text-lg font-semibold text-neutral-100 mb-2 group-hover:text-accent-green-60 transition-colors">
                    Twitter
                  </h3>
                  <p className="text-neutral-60">@yourusername</p>
                </a>
              </div>

              <div className="p-8 border border-neutral-30 rounded-lg bg-neutral-10">
                <h3 className="text-2xl font-semibold text-neutral-100 mb-3">
                  Let's Work Together
                </h3>
                <p className="text-neutral-60 mb-6">
                  I'm always interested in new projects and opportunities. Feel free to reach out!
                </p>
                <Button asChild size="lg" className="bg-neutral-100 hover:bg-neutral-80 text-white">
                  <a href="mailto:your.email@example.com">Send an Email</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-neutral-30">
          <div className="px-8 lg:px-16">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-neutral-50 text-sm">
                © {new Date().getFullYear()} Martin Cam. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a
                  href="https://github.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-50 hover:text-neutral-100 text-sm transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-50 hover:text-neutral-100 text-sm transition-colors"
                >
                  LinkedIn
                </a>
                <a
                  href="https://twitter.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-50 hover:text-neutral-100 text-sm transition-colors"
                >
                  Twitter
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
