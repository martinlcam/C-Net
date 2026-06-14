import {
  Activity,
  Cloud,
  Cog,
  Cpu,
  Database,
  GitBranch,
  Globe,
  HardDrive,
  Network,
  Radio,
  Server,
  Shield,
} from "lucide-react"
import type { TopoEdge, TopoGroup, TopoNode } from "@/components/ui/network-topology"

/**
 * The one canonical C-Net deployment topology, rendered identically in the
 * About card and the full deployment writeup. Geometry is collision-checked
 * (see git history) — keep the layout in sync if you move a node.
 *
 *   PVE HOST ⊃ PROXMOX LXC. Cloudflare tunnels down the centre into Caddy,
 *   which fans out to web/api/realtime. Redis is the central pub/sub hub;
 *   the EEG bridge lives on the host and publishes up across the LXC boundary.
 */

export const TOPOLOGY_VIEWBOX = { width: 760, height: 520 }

export const TOPOLOGY_GROUPS: TopoGroup[] = [
  { id: "pve", label: "PVE host", x: 40, y: 115, width: 680, height: 380 },
  {
    id: "lxc",
    label: "Proxmox LXC · Debian 12",
    x: 70,
    y: 145,
    width: 620,
    height: 255,
    accent: true,
  },
]

export const TOPOLOGY_NODES: TopoNode[] = [
  { id: "github", label: "GitHub", icon: <GitBranch />, x: 120, y: 45 },
  { id: "ci", label: "CI checks", icon: <Cpu />, x: 255, y: 45 },
  { id: "cf", label: "Cloudflare", icon: <Cloud />, x: 400, y: 45 },
  { id: "runner", label: "runner", icon: <Server />, x: 170, y: 185 },
  { id: "caddy", label: "Caddy", icon: <Network />, x: 400, y: 185 },
  { id: "web", label: "web", sub: ":3001", icon: <Globe />, x: 200, y: 275 },
  { id: "api", label: "api", sub: ":4000", icon: <Shield />, x: 400, y: 275 },
  { id: "realtime", label: "realtime", sub: ":4002", icon: <Radio />, x: 600, y: 275 },
  {
    id: "redis",
    label: "Redis",
    sub: "pub/sub",
    icon: <HardDrive />,
    x: 400,
    y: 365,
    accent: true,
  },
  { id: "postgres", label: "Postgres", icon: <Database />, x: 560, y: 365 },
  { id: "workers", label: "workers", icon: <Cog />, x: 240, y: 365 },
  { id: "bridge", label: "EEG bridge", icon: <Activity />, x: 150, y: 455 },
]

export const TOPOLOGY_EDGES: TopoEdge[] = [
  // Control plane — dashed, static: push to main → runner builds & restarts.
  { from: "github", to: "ci", kind: "control" },
  { from: "github", to: "runner", kind: "control" },
  { from: "runner", to: "web", kind: "control" },

  // Data plane — ingress: Cloudflare tunnel → Caddy → the three HTTP services.
  { from: "cf", to: "caddy", bidirectional: true },
  { from: "caddy", to: "web", bidirectional: true },
  { from: "caddy", to: "api", bidirectional: true },
  { from: "caddy", to: "realtime", bidirectional: true },

  // Data plane — the dashboard consumes the api, same-origin.
  { from: "web", to: "api", bidirectional: true },

  // Data plane — api owns Postgres, produces/reads the Redis bus.
  { from: "api", to: "postgres", bidirectional: true },
  { from: "api", to: "redis", bidirectional: true },

  // Data plane — Redis pub/sub hub.
  { from: "realtime", to: "redis", bidirectional: true },
  { from: "workers", to: "redis", bidirectional: true },

  // Data plane — bridge publishes EEG frames up across the LXC boundary (one way).
  {
    from: "bridge",
    to: "redis",
    fromSide: "top",
    toSide: "bottom",
    waypoints: [
      { x: 150, y: 405 },
      { x: 400, y: 405 },
    ],
  },
]
