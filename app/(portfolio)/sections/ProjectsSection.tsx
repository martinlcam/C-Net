import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/stories/card/card"
import { Button } from "@/stories/button/button"

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

export function ProjectsSection() {
  return (
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
  )
}
