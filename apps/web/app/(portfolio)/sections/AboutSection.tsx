"use client"

import { NetworkTopology } from "@/components/ui/network-topology"
import {
  TOPOLOGY_EDGES,
  TOPOLOGY_GROUPS,
  TOPOLOGY_NODES,
  TOPOLOGY_VIEWBOX,
} from "../_data/topology"

const SKILLS = [
  {
    title: "Frontend",
    items: ["React & Next.js", "TypeScript", "Tailwind CSS", "TanStack Query", "Zustand"],
  },
  {
    title: "Backend",
    items: ["Node.js & Express", "PostgreSQL", "Drizzle ORM", "Redis & BullMQ", "REST APIs"],
  },
  { title: "Infrastructure", items: ["Proxmox", "Docker", "Linux Admin", "CI/CD", "Monitoring"] },
  {
    title: "Tools",
    items: ["Git & GitHub", "Biome", "TypeScript Strict", "Bun Runtime", "VS Code"],
  },
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 px-12 lg:px-20 border-b border-black">
      <div>
        <h2 className="text-5xl md:text-6xl font-bold text-black mb-12 tracking-tight">
          About<span className="text-[#bea9e9]">.</span>
        </h2>

        {/* One row: personal bio · 4 skill squares · deployment topology (fans out, 4:4:6) */}
        <div className="grid lg:grid-cols-[minmax(220px,4fr)_minmax(260px,4fr)_minmax(360px,6fr)] gap-10 lg:gap-12 items-start">
          {/* Personal bio */}
          <div className="line-through">
            <h3 className="text-2xl font-semibold text-black mb-4">Personal Bio</h3>
            <p className="text-base text-gray-700 mb-4 leading-relaxed">
              I'm a full-stack developer passionate about building modern web applications and
              managing infrastructure. I enjoy working with cutting-edge technologies and solving
              complex problems.
            </p>
            <p className="text-base text-gray-700 leading-relaxed">
              My expertise spans frontend and backend development, with a focus on creating
              scalable, maintainable applications. I'm particularly interested in homelab
              infrastructure management and DevOps practices.
            </p>
          </div>

          {/* Skill boxes — locked to 1:1 squares */}
          <div className="grid grid-cols-2 gap-4">
            {SKILLS.map((skill) => (
              <div
                key={skill.title}
                className="aspect-square border border-black p-4 flex flex-col"
              >
                <h4 className="text-base font-semibold text-black mb-2">{skill.title}</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {skill.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Deployment topology */}
          <div className="border border-black p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-black">Deployment topology</h4>
                <p className="mt-1 text-xs font-mono text-gray-500 uppercase tracking-[0.12em]">
                  Proxmox LXC · Bun · systemd · Cloudflare Tunnel
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#bea9e9] border border-[#bea9e9]/40 px-2 py-1 shrink-0">
                self-hosted
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              Push to <code className="font-mono text-xs bg-black/[0.05] px-1 rounded">main</code> →
              the self-hosted runner pulls into the Debian LXC and restarts the Bun services. The
              EEG bridge runs on the Proxmox host and publishes to the LXC's Redis.
            </p>
            <NetworkTopology
              nodes={TOPOLOGY_NODES}
              edges={TOPOLOGY_EDGES}
              groups={TOPOLOGY_GROUPS}
              width={TOPOLOGY_VIEWBOX.width}
              height={TOPOLOGY_VIEWBOX.height}
              showGrid={false}
            />
            <p className="mt-4 text-[11px] font-mono text-gray-400 uppercase tracking-[0.12em] leading-relaxed">
              solid + pulse = live request / pub-sub · dashed = ci &amp; deploy · boxes =
              infrastructure boundaries
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
