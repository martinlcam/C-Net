import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ProjectsPage() {
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
    <div className="min-h-screen bg-neutral-10">
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-5xl font-bold text-primary-purple-80 mb-4 text-center">Projects</h1>
        <p className="text-xl text-neutral-70 mb-12 text-center max-w-2xl mx-auto">
          A collection of projects showcasing my work in full-stack development, infrastructure
          management, and modern web technologies.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-primary-purple-70">{project.title}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-1 bg-primary-purple-10 text-primary-purple-60 rounded text-xs"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={project.github} target="_blank" rel="noopener noreferrer">
                    GitHub
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={project.demo}>Demo</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
