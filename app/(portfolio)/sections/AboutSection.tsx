export function AboutSection() {
  return (
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
      </div>
    </section>
  )
}
