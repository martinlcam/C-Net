import Link from "next/link"
import { Button } from "@/stories/button/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/stories/card/card"

const GITHUB_REPO = "https://github.com/martinlcam/C-Net"

const projects = [
  {
    id: 1,
    title: "C-Net Dashboard",
    description:
      "A self-hosted homelab dashboard. Includes a personal cloud-storage Vault backed by the Proxmox host's ZFS tank — chunked resumable uploads, per-user quotas, and signed-URL delivery through Caddy — plus a Netflix-style media library wired into the *arr stack: Radarr/Sonarr handle requests and downloads while Jellyfin streams movies and TV back with resume support. Rounded out with real-time VM, container, and service monitoring.",
    technologies: [
      "Next.js 16",
      "React 19",
      "TypeScript",
      "Drizzle ORM",
      "Proxmox",
      "ZFS",
      "Redis",
      "Radarr",
      "Sonarr",
      "Jellyfin",
    ],
    github: GITHUB_REPO,
  },
  {
    id: 2,
    title: "BFIDA*",
    description:
      "An interactive peg-solitaire solver and visualizer. Implements Bidirectional Breadth-First Iterative-Deepening A* (Barker & Korf, AAAI 2012) to search the state space, with a playable board and a step-by-step animation of the algorithm as it prunes and closes in on a single-peg solution.",
    technologies: ["Next.js 16", "React 19", "TypeScript", "Heuristic Search", "Canvas"],
    github: GITHUB_REPO,
  },
  {
    id: 3,
    title: "BD — Braindance",
    description:
      "A real-time neural telemetry readout from a Muse 2 headband. A Python bridge (bleak) streams BLE EEG/IMU data into Redis pub/sub on a Proxmox VM; batched frames fan out over WebSocket to a live oscilloscope, band-power, and contact-quality HUD at ~30 Hz — the front end for ML models trained to infer intent and trigger actions.",
    technologies: ["Python", "bleak", "Redis", "WebSocket", "Proxmox", "Next.js 16"],
    github: GITHUB_REPO,
  },
]

export function ProjectsSection() {
  return (
    <section id="projects" className="py-24 px-12 lg:px-20 border-b border-black">
      <div className="max-w-7xl">
        <h2 className="text-5xl md:text-6xl font-bold text-black mb-12 tracking-tight">
          Projects<span className="text-[#bea9e9]">.</span>
        </h2>

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
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
