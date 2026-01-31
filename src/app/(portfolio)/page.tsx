import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-black mb-6">
            Welcome to My Portfolio
          </h1>
          <p className="text-xl text-neutral-70 mb-8">
            Full-stack developer passionate about building modern web applications and managing
            infrastructure
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/cnet/dashboard">C-Net Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/projects">View Projects</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Projects Preview */}
      <section className="container mx-auto px-4 py-16 bg-neutral-10">
        <h2 className="text-4xl font-bold text-center text-black mb-12">
          Featured Projects
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="p-6 border-2 border-black rounded-lg hover:shadow-lg transition-shadow bg-white">
            <h3 className="text-xl font-semibold text-black mb-2">C-Net</h3>
            <p className="text-neutral-70 mb-4">
              Homelab dashboard for managing VMs, containers, and services
            </p>
            <Link href="/cnet/dashboard" className="text-black font-medium hover:underline">
              Explore →
            </Link>
          </div>
          <div className="p-6 border-2 border-black rounded-lg hover:shadow-lg transition-shadow bg-white">
            <h3 className="text-xl font-semibold text-black mb-2">Project 2</h3>
            <p className="text-neutral-70 mb-4">Description of project 2</p>
            <Link href="/projects" className="text-black font-medium hover:underline">
              Learn More →
            </Link>
          </div>
          <div className="p-6 border-2 border-black rounded-lg hover:shadow-lg transition-shadow bg-white">
            <h3 className="text-xl font-semibold text-black mb-2">Project 3</h3>
            <p className="text-neutral-70 mb-4">Description of project 3</p>
            <Link href="/projects" className="text-black font-medium hover:underline">
              Learn More →
            </Link>
          </div>
        </div>
      </section>

      {/* Skills Overview */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center text-black mb-12">Skills</h2>
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-neutral-10 border-2 border-black rounded-lg">
            <h3 className="text-xl font-semibold text-black mb-2">Frontend</h3>
            <p className="text-neutral-70">React, Next.js, TypeScript, Tailwind CSS</p>
          </div>
          <div className="text-center p-6 bg-neutral-10 border-2 border-black rounded-lg">
            <h3 className="text-xl font-semibold text-black mb-2">Backend</h3>
            <p className="text-neutral-70">Node.js, Express, PostgreSQL, Drizzle ORM</p>
          </div>
          <div className="text-center p-6 bg-neutral-10 border-2 border-black rounded-lg">
            <h3 className="text-xl font-semibold text-black mb-2">DevOps</h3>
            <p className="text-neutral-70">Docker, Proxmox, Redis, CI/CD</p>
          </div>
        </div>
      </section>
    </div>
  )
}
