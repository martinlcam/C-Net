export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-10">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-primary-purple-80 mb-8">About Me</h1>

          <section className="mb-12">
            <h2 className="text-3xl font-semibold text-primary-purple-70 mb-4">Personal Bio</h2>
            <p className="text-lg text-neutral-70 mb-4">
              I'm a full-stack developer passionate about building modern web applications and
              managing infrastructure. I enjoy working with cutting-edge technologies and solving
              complex problems.
            </p>
            <p className="text-lg text-neutral-70">
              My expertise spans frontend and backend development, with a focus on creating
              scalable, maintainable applications. I'm particularly interested in homelab
              infrastructure management and DevOps practices.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-semibold text-primary-purple-70 mb-4">Skills & Experience</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold text-primary-purple-60 mb-2">Frontend</h3>
                <ul className="list-disc list-inside text-neutral-70 space-y-1">
                  <li>React & Next.js</li>
                  <li>TypeScript</li>
                  <li>Tailwind CSS</li>
                  <li>TanStack Query</li>
                  <li>Zustand</li>
                  <li>Radix UI</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-primary-purple-60 mb-2">Backend</h3>
                <ul className="list-disc list-inside text-neutral-70 space-y-1">
                  <li>Node.js & Express</li>
                  <li>PostgreSQL</li>
                  <li>Drizzle ORM</li>
                  <li>Redis & BullMQ</li>
                  <li>REST APIs</li>
                  <li>Authentication & Authorization</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-primary-purple-60 mb-2">Infrastructure</h3>
                <ul className="list-disc list-inside text-neutral-70 space-y-1">
                  <li>Proxmox</li>
                  <li>Docker & Containers</li>
                  <li>Linux Administration</li>
                  <li>CI/CD</li>
                  <li>Monitoring & Metrics</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-primary-purple-60 mb-2">Tools</h3>
                <ul className="list-disc list-inside text-neutral-70 space-y-1">
                  <li>Git & GitHub</li>
                  <li>Biome (Linting & Formatting)</li>
                  <li>TypeScript Strict Mode</li>
                  <li>Bun Runtime</li>
                  <li>VS Code</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-semibold text-primary-purple-70 mb-4">Technologies Used</h2>
            <div className="flex flex-wrap gap-2">
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
                  className="px-3 py-1 bg-primary-purple-20 text-primary-purple-70 rounded-full text-sm font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
