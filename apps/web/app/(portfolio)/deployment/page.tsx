"use client"

import Link from "next/link"
import { AuthModal } from "@/components/AuthModal"
import { NetworkTopology } from "@/components/ui/network-topology"
import {
  TOPOLOGY_EDGES,
  TOPOLOGY_GROUPS,
  TOPOLOGY_NODES,
  TOPOLOGY_VIEWBOX,
} from "../_data/topology"
import { FooterSection } from "../sections/FooterSection"
import { HeaderSection } from "../sections/HeaderSection"

export default function DeploymentWriteupPage() {
  return (
    <div className="min-h-screen w-full bg-[#faf6f1] text-gray-900">
      <AuthModal />
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />

      <article className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <Link
          href="/"
          className="inline-block mb-10 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Back
        </Link>

        <header className="mb-12">
          <h1 className="font-satoshi text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            How C-Net actually runs: Proxmox, Bun, and a Cloudflare tunnel
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.2em] text-gray-400">
            Martin · June 2026
          </p>
        </header>

        <Prose>
          <p>
            This site doesn't run on Vercel anymore. It runs on a box in my room, behind a
            Cloudflare tunnel, managed by a self-hosted GitHub Actions runner that deploys on every
            push to main. This is the writeup for how that all fits together — the actual
            architecture, the actual scripts, the reasoning behind every decision.
          </p>
          <p>
            Warning: this is going to be long and technical. That's the point. I want a place to
            document this properly so I don't have to reconstruct it from memory six months from
            now.
          </p>

          <H2>Why leave Vercel</H2>
          <p>
            C-Net is a homelab dashboard. It's designed to talk to a Proxmox node, query VM and
            container state, pipe live EEG data from a Bluetooth headband through Redis and out to a
            browser. None of that runs on Vercel — the api, the realtime WebSocket server, the
            BullMQ workers, the Postgres database, Redis — all of it was running locally, dev-only,
            effectively never deployed.
          </p>
          <p>
            The key insight in the migration design doc is that moving to Proxmox is not just a
            hosting change. It places the app <em>on the machine it's designed to manage</em>. The
            dashboard can now actually call <code>localhost:8006</code> (the Proxmox API) over the
            internal network instead of going out to the internet and back. Co-location is the
            feature.
          </p>
          <p>
            And practically speaking: the free Vercel tier doesn't do WebSockets, doesn't do
            persistent connections, doesn't do background workers. The whole point of this project
            requires all three.
          </p>

          <H2>The monorepo</H2>
          <p>
            The repo is a Bun Turborepo. Bun is both the package manager and the runtime — no npm,
            no node for the application code itself. The monorepo has five apps:
          </p>
          <ul>
            <li>
              <strong>web</strong> — Next.js 16 frontend on port 3001. This is the portfolio site
              you're reading right now, and also the authenticated C-Net dashboard under{" "}
              <code>/cnet</code>. Same Next app, two faces, gated by next-auth session state.
            </li>
            <li>
              <strong>api</strong> — Express + tsoa REST API on port 4000. tsoa generates OpenAPI
              spec and route registration from TypeScript decorators on the controller classes. All
              the Proxmox control, metrics, service management, and contact routes live here.
            </li>
            <li>
              <strong>realtime</strong> — Bun's native WebSocket server on port 4002. Its entire job
              is subscribing to Redis pub/sub channels and fanning the payloads out to connected
              WebSocket clients. No business logic. It's a loudspeaker.
            </li>
            <li>
              <strong>workers</strong> — BullMQ job workers. Background processing, queue consumers.
              No HTTP port.
            </li>
            <li>
              <strong>neural-bridge</strong> — Python. Intentionally outside the JS monorepo. This
              one talks Bluetooth to the Muse EEG headband and publishes frames into Redis. More on
              this later.
            </li>
          </ul>
          <p>
            There are also shared packages: <code>@cnet/db</code> (Drizzle ORM schema and
            migrations), <code>@cnet/core</code> (shared utilities and env validation),{" "}
            <code>@cnet/engine</code>, and <code>@cnet/api-client</code> (typed fetch wrapper for
            the frontend). Turbo handles the build graph — knows that web and api depend on db,
            knows to build those first.
          </p>

          <H2>The box</H2>
          <p>
            The hardware is a machine sitting in my room running Proxmox VE. Proxmox is a hypervisor
            — it manages VMs and LXC containers on bare metal Linux. The C-Net stack lives inside a{" "}
            <em>dedicated Debian 12 LXC container</em> on that node. Not a VM: an LXC container is
            much lighter, shares the host kernel, starts in under a second.
          </p>
          <p>
            The LXC has nesting enabled (needed to run Docker containers inside it) and lives on the
            Proxmox internal bridge <code>vmbr0</code>. It has a static internal IP. The internet
            can not reach it directly — there are no open ports on the router. Public traffic gets
            in a completely different way (Cloudflare Tunnel, see below).
          </p>
          <p>
            Installed inside the LXC: Bun, Node (for build tooling parity), Docker + Compose (only
            for the database layer), Caddy (reverse proxy), cloudflared (the tunnel daemon), and the
            GitHub Actions runner. The repo is cloned to <code>/opt/cnet</code> and owned by a
            system user called <code>cnet</code>.
          </p>

          <H2>App processes and systemd</H2>
          <p>
            The four app processes — web, api, realtime, workers — run as native Bun processes
            directly under systemd. No Docker for the app layer. This is intentional and it's one of
            the more interesting decisions in the design.
          </p>
          <p>
            The standard move for something like this is usually "containerize everything,
            docker-compose up." But containerizing Bun apps inside an LXC that's already doing
            container-level isolation is layering abstractions that don't add anything. What you get
            instead: longer deploy times (image builds), more moving parts, harder log aggregation.
            What you give up: basically nothing, in this context.
          </p>
          <p>
            With systemd you get: process supervision for free (<code>Restart=on-failure</code>),
            proper journal logging (<code>journalctl -u cnet-web -f</code>), clean dependency
            ordering (<code>After=cnet-api.service</code>), and zero image build time on deploy. The
            four units are <code>cnet-web</code>, <code>cnet-api</code>, <code>cnet-realtime</code>,
            and <code>cnet-workers</code>. Each has <code>EnvironmentFile=/opt/cnet/.env</code> so
            secrets load at process start without being baked into anything.
          </p>

          <H2>Databases: Docker containers inside the LXC</H2>
          <p>
            Postgres and Redis <em>do</em> run in Docker, but only them. A trimmed{" "}
            <code>docker-compose</code> file brings up two containers: postgres and redis. Postgres
            has its data volume persisted to the LXC's disk. Redis is ephemeral — it's used for
            pub/sub and BullMQ queues, not durable storage, so losing it on restart is fine.
          </p>
          <p>
            Redis is configured to bind on both <code>127.0.0.1</code> and the LXC's internal
            network IP. The internal IP binding is important: it's what lets the neural bridge on
            the PVE host reach Redis across the <code>vmbr0</code> bridge without going through any
            external network. More on that in the bridge section.
          </p>
          <p>
            Migrations are Drizzle ORM, committed to the repo alongside the schema. The deploy
            script runs <code>bun run db:migrate</code> on every deploy, which is idempotent —
            Drizzle tracks which migrations have been applied in a <code>__drizzle_migrations</code>{" "}
            table. A migration you forget to commit locally will not reach production; the deploy
            would build against schema the database doesn't have. So: generate, commit the SQL files
            in the same changeset as the schema edit, push.
          </p>

          <H2>Ingress: Cloudflare Tunnel and Caddy</H2>
          <p>
            This is probably the most elegant part of the setup. The machine is behind a dynamic
            home IP, likely behind CGNAT, with no port forwarding. How does public traffic reach it?
          </p>
          <p>
            Cloudflare Tunnel. <code>cloudflared</code> runs as a systemd service in the LXC. It
            establishes an outbound-only connection to Cloudflare's edge network. When a request
            comes in for <code>martin.cam</code>, Cloudflare's edge routes it through that tunnel to{" "}
            <code>cloudflared</code> in the LXC, which forwards it to Caddy on{" "}
            <code>localhost:80</code>. No inbound ports. No port forwarding. Works behind CGNAT. The
            router doesn't know this is happening.
          </p>
          <p>
            TLS terminates at Cloudflare. The tunnel carries traffic over an encrypted connection
            already; the internal leg (tunnel → Caddy → app) is plain HTTP on the loopback. This is
            fine and normal.
          </p>
          <p>
            Caddy is the single origin the tunnel points at. It does path-based routing for the
            single public hostname <code>martin.cam</code>:
          </p>
          <ul>
            <li>
              <code>/svc/*</code> → api on port 4000. The tsoa routes all got a <code>/svc</code>{" "}
              prefix added to avoid collision with Next.js's own <code>/api/*</code> namespace. So{" "}
              <code>/svc/proxmox/vms</code>, <code>/svc/health</code>, etc.
            </li>
            <li>
              <code>/ws</code> → realtime WebSocket server on port 4002. Cloudflare Tunnel supports
              WebSocket upgrades; this just works.
            </li>
            <li>Everything else → web on port 3001. Next.js owns its full route tree from here.</li>
          </ul>
          <p>
            Because everything is served from the same origin (<code>martin.cam</code>), there is no
            CORS. The next-auth session cookie is automatically sent to <code>/svc/*</code> API
            calls. This is cleaner than the cross-port local dev setup where you need{" "}
            <code>credentials: "include"</code> and an explicit <code>CORS_ORIGIN</code> header.
            Same-origin for free.
          </p>

          <H2>The CI/CD pipeline</H2>
          <p>
            Pushing to <code>main</code> triggers GitHub Actions. The existing CI jobs — commitlint,
            bugcat, Biome format/lint, TypeScript type-check, full turbo build, SonarQube — still
            run on GitHub-hosted runners, unchanged. Those are cheap and I don't want to burn my
            self-hosted runner's resources on things Bun doesn't need to touch the box for.
          </p>
          <p>
            A <code>deploy</code> job sits downstream of the <code>build</code> job in the workflow.
            It only runs on pushes to <code>main</code>. Its <code>runs-on: self-hosted</code> label
            picks it up on the runner inside the LXC.
          </p>
          <p>
            The runner is installed as a <code>cnet</code>-user service via the GitHub Actions
            runner's built-in <code>svc.sh install</code> script. It's an outbound-only connection
            to GitHub's job queue — no exposed endpoint, same security shape as the tunnel.
          </p>
          <p>The deploy script is deliberately simple:</p>
          <CodeBlock label="scripts/deploy.sh" code={CODE_DEPLOY} />
          <p>
            That's it. Git pull, install deps with the frozen lockfile, build everything with Turbo,
            apply any new migrations, restart the four systemd units. The <code>cnet</code> service
            user has a narrow <code>sudoers</code> rule granting exactly those four{" "}
            <code>systemctl restart</code> commands and nothing else.
          </p>
          <p>
            Rollback is: re-run the workflow at an earlier SHA, or SSH into the box and run{" "}
            <code>scripts/deploy.sh</code> after <code>git checkout &lt;old-sha&gt;</code>. The LXC
            snapshot taken before cutover is the heavy-hammer fallback — restore it and you're back
            to a clean state with zero thought required.
          </p>
          <p>
            One thing worth noting: the build happens on the box. The Next.js build is the heavy
            step — webpack/turbopack compiling the whole app, generating static pages. This is
            deliberately accepted. Builds are infrequent (only on push to main), and the CPU spike
            is fine for a homelab. The alternative — building on a GitHub runner and shipping a
            build artifact — would require either Docker image publishing or a custom artifact
            transfer scheme. Not worth the complexity here.
          </p>

          <H2>The neural bridge</H2>
          <p>
            The Muse EEG headband connects over Bluetooth, and Bluetooth is a hardware radio on the
            Proxmox host — not inside the LXC. LXC containers don't get bare-metal hardware access
            by default. You <em>can</em> passthrough Bluetooth to an LXC but it's messy and couples
            the container to host hardware in a way that's annoying to manage.
          </p>
          <p>
            So the neural bridge stays on the PVE host. It's a Python program using{" "}
            <code>bleak</code> (BLE async library) and BrainFlow (signal processing). It scans for
            the Muse, connects, decodes the packed 12-bit EEG samples, and publishes JSON frames to
            Redis pub/sub channels <code>bd:samples</code> and <code>bd:status</code>.
          </p>
          <p>
            The bridge's <code>REDIS_URL</code> used to point at <code>localhost</code> when
            everything was running on the host. After the migration it points at the LXC's internal
            IP: <code>redis://&lt;LXC_IP&gt;:6379</code>. That's the entire change to the bridge.
            The pub/sub contract — channel names, frame shapes, everything — is untouched.
          </p>
          <p>
            The realtime server inside the LXC subscribes to those same Redis channels and fans
            every incoming message out to all connected WebSocket clients. The browser doesn't know
            Python exists. The bridge doesn't know browsers exist. They both just talk to Redis.
          </p>
          <CodeBlock label="neural-bridge → Redis → realtime" code={CODE_RELAY} />
          <p>
            One practical detail: Redis is bound to both loopback and the internal LXC IP. The
            Proxmox internal network (<code>vmbr0</code>) connects the host and the LXC. Redis is
            firewalled to the Proxmox internal network only — it never touches the Cloudflare
            tunnel, never exits the box.
          </p>

          <H2>The full picture</H2>
          <p>
            Here's the whole thing as one diagram. The two nested boxes are infrastructure: the{" "}
            <em>PVE host</em> (the bare-metal Proxmox node) and, inside it, the <em>Proxmox LXC</em>{" "}
            — the Debian container the whole app stack actually lives in. The services are
            components <em>inside</em> that container, not peers of it.
          </p>
          <p>
            Two kinds of trace, deliberately drawn differently. <em>Dashed, static</em> lines are
            the control plane — GitHub driving CI and the self-hosted runner that builds and
            restarts the services. <em>Solid lines with a travelling pulse</em> are the live data
            plane — request traffic and pub/sub. Caddy is the one origin everything enters through;
            it fans inbound traffic out to the three HTTP services like a router. Redis sits at the
            center as a bidirectional pub/sub bus — the bridge publishes into it, realtime and
            workers read from it, the api both produces jobs and reads cache.
          </p>
        </Prose>

        <div className="my-8">
          <NetworkTopology
            nodes={TOPOLOGY_NODES}
            edges={TOPOLOGY_EDGES}
            groups={TOPOLOGY_GROUPS}
            width={TOPOLOGY_VIEWBOX.width}
            height={TOPOLOGY_VIEWBOX.height}
            showGrid={true}
          />
        </div>

        <Prose>
          <p className="text-sm text-gray-500 font-mono -mt-4 mb-6">
            Deployment topology. Boxes are infrastructure boundaries; solid traces with a travelling
            pulse are live request / pub-sub paths, dashed static traces are the CI &amp; deploy
            control plane.
          </p>

          <H2>Security posture</H2>
          <p>A few things worth spelling out explicitly because they're easy to miss:</p>
          <ul>
            <li>
              <strong>No open router ports.</strong> Cloudflare Tunnel is the only way in. The
              router doesn't forward anything. There is no SSH exposed publicly. If I need to SSH
              into the box I'm on the local network.
            </li>
            <li>
              <strong>
                Secrets in <code>.env</code>, never in git.
              </strong>{" "}
              The <code>.env</code> file at <code>/opt/cnet/.env</code> is <code>chmod 600</code>{" "}
              and owned by the <code>cnet</code> user. The deploy script never touches it. The
              runner user can't read it (it's loaded by systemd's <code>EnvironmentFile</code>{" "}
              directive, not the runner process).
            </li>
            <li>
              <strong>Least-privilege runner.</strong> The <code>cnet</code> service user that runs
              the deploy script has exactly one sudo capability: restart the four named systemd
              units. Nothing else.
            </li>
            <li>
              <strong>Postgres and Redis are internal only.</strong> They bind on{" "}
              <code>127.0.0.1</code> plus the internal vmbr0 interface. No public exposure.
              Cloudflare's WAF never sees a request that touches the database layer directly.
            </li>
            <li>
              <strong>next-auth as the first auth gate.</strong> The dashboard is gated by Google
              OAuth through next-auth with an allowlisted email. The plan for when Proxmox-control
              routes go live is Cloudflare Access as a second gate in front of
              <code>/cnet/*</code> — zero-trust, requires the Google account, before the request
              even reaches Next.js.
            </li>
          </ul>

          <H2>What's not built yet</H2>
          <p>The migration design deliberately left architectural seams for two future modules:</p>
          <p>
            <strong>Proxmox control.</strong> The LXC can reach{" "}
            <code>https://&lt;pve-host&gt;:8006</code> over the internal network. A new controller
            in <code>apps/api</code> will talk to the PVE API (with a least-privilege API token) and
            surface VM/LXC state, start/stop/reboot controls, and storage status under{" "}
            <code>/svc/proxmox/*</code>. The dashboard page already calls <code>/proxmox/vms</code>{" "}
            — it's just not wired up yet.
          </p>
          <p>
            <strong>Storage as a personal cloud drive.</strong> The Proxmox node has ZFS storage
            tanks. The plan is a bind mount from the PVE host dataset into the LXC, then an
            authenticated browse/stream/upload API under <code>/svc/storage/*</code>. Files served
            through the Cloudflare tunnel means throughput is bounded by home upload bandwidth,
            which is fine for personal use.
          </p>
          <p>
            <strong>Brain-control model.</strong> The EEG pipeline is the telemetry layer. The
            actual project is feeding those signals into a model that learns my patterns and turns
            them into computer actions. The pipe is working. That's step one.
          </p>

          <H2>Stuff that surprised me</H2>
          <p>A few things that weren't obvious going into this:</p>
          <p>
            <strong>Same-origin is a bigger deal than I expected.</strong> Running everything behind
            a single hostname eliminates an entire category of problems. No CORS headers. No cookie
            domain configuration. next-auth session cookies just work on API calls. The frontend's{" "}
            <code>NEXT_PUBLIC_API_URL</code> is just <code>/svc</code> — a relative path. It's much
            simpler.
          </p>
          <p>
            <strong>The build-on-box decision is fine.</strong> I was worried about CPU spikes
            during deploys. In practice: the Next.js build runs, the machine is occupied for a
            couple of minutes, then it's done and everything restarts. For a homelab that deploys
            infrequently this is completely acceptable. The alternative — building on CI and
            shipping artifacts — is meaningfully more complex.
          </p>
          <p>
            <strong>LXC snapshots are really good rollback.</strong> Before cutover I snapshotted
            the LXC. If a deploy goes badly wrong, restore from snapshot and you're back to a clean
            state instantly, no git archaeology required.
          </p>
          <p>
            <strong>cloudflared WebSocket support just works.</strong> I expected to have to do
            something special to proxy WebSocket connections through the tunnel. Nope. Cloudflare
            Tunnel passes WebSocket upgrade requests through transparently.
          </p>

          <H2>The Caddyfile</H2>
          <p>
            For completeness, the routing config. Caddy automatically handles the WebSocket upgrade
            for the realtime path — that's just the default behavior when you reverse-proxy to a
            WebSocket server.
          </p>
          <CodeBlock label="deploy/Caddyfile" code={CODE_CADDY} />
        </Prose>

        <div className="mt-16 border-t border-gray-200 pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 transition-colors hover:text-[#ad70eb]"
          >
            ← Home
          </Link>
        </div>
      </article>

      <FooterSection />
    </div>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 font-satoshi text-lg leading-relaxed text-gray-800 [&_em]:text-gray-900 [&_em]:not-italic [&_em]:font-medium [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_li]:text-gray-800 [&_code]:font-mono [&_code]:text-sm [&_code]:bg-black/[0.05] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
      {children}
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-satoshi text-2xl md:text-3xl font-bold tracking-tight text-gray-900 pt-6">
      {children}
    </h2>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="my-6 overflow-hidden rounded-md border border-black/10 bg-[#1e1e1e] font-mono text-sm">
      {label ? (
        <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">
          {label}
        </div>
      ) : null}
      <pre
        className="overflow-x-auto px-4 py-3 text-gray-300 leading-relaxed"
        style={{ fontSize: "0.875rem" }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

const CODE_DEPLOY = `#!/usr/bin/env bash
set -euo pipefail
cd /opt/cnet

git pull --ff-only
bun install --frozen-lockfile
bunx turbo build
bunx turbo db:migrate --filter=@cnet/db
sudo systemctl restart cnet-web cnet-api cnet-realtime cnet-workers`

const CODE_RELAY = `// realtime (Bun): subscribe to Redis and fan out to every WebSocket viewer
redisSub.subscribe("bd:samples", "bd:status")
redisSub.on("message", (_channel, payload) => {
  server.publish("bd", payload)   // Bun's native pub/sub to all WS clients
})

// The bridge never changes. It just publishes to Redis.
// REDIS_URL now points at the LXC IP instead of localhost.
// REDIS_URL=redis://:password@<LXC_IP>:6379`

const CODE_CADDY = `martin.cam {
    # API — all backend routes under /svc
    handle /svc/* {
        reverse_proxy localhost:4000
    }

    # Realtime WebSocket
    handle /ws* {
        reverse_proxy localhost:4002
    }

    # Everything else — Next.js
    handle {
        reverse_proxy localhost:3001
    }
}`
