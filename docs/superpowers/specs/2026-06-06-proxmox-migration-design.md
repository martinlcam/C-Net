# C-Net → Proxmox Migration & Self-Hosting Design

**Date:** 2026-06-06
**Status:** Approved design — ready for implementation planning
**Scope:** Re-home the C-Net stack from Vercel to a self-hosted Proxmox node, with a
git-push deploy pipeline and clean seams for future Proxmox-control and storage features.

---

## 1. Background & Motivation

C-Net is a Turborepo (Bun) homelab dashboard. Its README already declares the product as
"a full-stack, self-hosted dashboard to monitor and manage a homelab environment, including
VMs, containers, NAS storage" — and the repo already carries `PROXMOX_USER` / `PROXMOX_TOKEN`
env vars and `docs/PROXMOX_SETUP.md`.

Today:

- `apps/web` (Next.js 16, port 3001) is deployed on **Vercel (free)**, fronted by **Cloudflare**,
  on the **`martin.cam`** domain (registered at Porkbun). The same Next app renders either the
  personal portfolio or the cnet dashboard depending on auth state.
- `apps/api` (Express + tsoa, port 4000), `apps/realtime` (Bun WebSocket, port 4002),
  `apps/workers` (BullMQ), and the local **Postgres + Redis** containers only run **locally**
  (`bun run db:start`) — they have never been deployed.
- `apps/neural-bridge` (Python, `bleak` BLE → Muse 2) publishes EEG frames to Redis pub/sub
  (`bd:samples` / `bd:status`); `apps/realtime` subscribes and fans them out over WebSocket.

**Key insight:** moving to Proxmox is not merely a hosting change — it places the app *on the
machine it is designed to manage*. That co-location is precisely what unlocks the planned
Proxmox-control and storage features. The migration must therefore set up those seams
deliberately, not just lift-and-shift.

---

## 2. Goals

1. **A. Migration strategy** — move web (and finally api/realtime/workers/data) off Vercel onto
   a Proxmox-hosted LXC, with a safe, reversible cutover.
2. **B. Integrations (future, not built now)** — leave clean architectural seams so the
   authenticated dashboard can later (a) browse/stream/upload files from the Proxmox storage
   tanks like a personal cloud drive, and (b) control VMs / LXC / Proxmox settings.
3. **C. Push-to-deploy CI/CD** — pushing to `main` automatically deploys to Proxmox, with the
   live "watch it deploy" feel of Vercel, **without** a manual Docker build/publish step.

### Non-goals (this spec)

- Implementing the storage or Proxmox-control modules (seams only).
- Rewriting any existing service. This is a re-home, not a rewrite.
- Multi-node / HA Proxmox. Single node.

---

## 3. Decisions (locked)

| Area | Decision |
|------|----------|
| App runtime location | **Dedicated LXC** on the Proxmox node |
| App processes | **Native Bun processes under `systemd`** (containerless) |
| Postgres + Redis | **Docker containers** inside the same LXC |
| Public ingress | **Cloudflare Tunnel** (`cloudflared`, outbound only, no open router ports) |
| Reverse proxy | **Caddy** inside the LXC — single origin the tunnel points at |
| Public hostname | **Single host `martin.cam`**, path-routed, **same-origin** |
| Deploy model | **Containerless git-pull** (`git pull → bun install → turbo build → restart`) |
| Deploy trigger | **Self-hosted GitHub Actions runner** in the LXC |
| Neural bridge | **Stays on the PVE host** (BLE hardware); `REDIS_URL` repointed to the LXC Redis |
| Data migration | **None required** — fresh migrations + re-login; optional `pg_dump` fallback |

---

## 4. Target Topology

```
                        Internet
                           │
                     Cloudflare (DNS + free WAF + optional Access)
                           │   Cloudflare Tunnel — outbound only, no open ports
        ┌──────────────────┴────────────────────────────────┐
        │  Proxmox node                                       │
        │                                                     │
        │  ┌─ LXC: cnet ──────────────────────────────────┐  │
        │  │  cloudflared ─┐                               │  │
        │  │               ▼                               │  │
        │  │   Caddy :80 ── /        ─► web (Bun/Next) 3001│  │
        │  │             ├─ /svc/*   ─► api  (Bun)     4000│  │
        │  │             └─ /ws      ─► realtime        4002│  │
        │  │   workers (Bun, no port)                      │  │
        │  │   ┌ docker ┐  postgres 5432 · redis 6379      │  │
        │  │   github-actions-runner (deploy, systemd)     │  │
        │  └──────────────────────▲────────────────────────┘  │
        │                         │ redis:// over vmbr0        │
        │   PVE host: neural-bridge (BLE → Muse 2) ───────────┘
        │   ZFS storage tanks      (future: bind-mount → LXC) │
        │   Proxmox API :8006      (future: api/proxmox module)│
        └────────────────────────────────────────────────────┘
```

All app-side services are native Bun processes managed by `systemd` in one LXC. Postgres + Redis
run as Docker containers in that same LXC. Caddy is the only origin `cloudflared` connects to.
Redis binds to the LXC's internal network IP so the host bridge can reach it — but Redis is
**never** routed through the tunnel.

---

## 5. Component Detail

### 5.1 The LXC

- Unprivileged Debian LXC on the Proxmox node, on the internal bridge (`vmbr0`).
- Installs: Bun, Node (for tooling parity), Docker + Compose (for PG/Redis only), `cloudflared`,
  Caddy, the GitHub Actions runner.
- Repo cloned to a fixed path (e.g. `/opt/cnet`). `.env` lives here at `chmod 600`, **never** in git.
- Snapshot the LXC before cutover for instant rollback.

### 5.2 Data services (Docker, co-located)

- A trimmed `docker-compose` (or the existing one, reduced to `postgres` + `redis`) runs inside
  the LXC.
- Postgres volume persisted; Redis is ephemeral (pub/sub + BullMQ).
- Redis configured to bind on the LXC internal IP (plus loopback) so the host-resident bridge can
  publish to it; firewalled to the Proxmox internal network only.

### 5.3 App processes (`systemd`)

Four units: `cnet-web`, `cnet-api`, `cnet-realtime`, `cnet-workers`. Each runs the production start
command (e.g. `bun run apps/.../...`) with `EnvironmentFile=/opt/cnet/.env`, `Restart=on-failure`,
and logs to the journal. Restarting these units is the last step of every deploy.

### 5.4 Reverse proxy (Caddy) & single-domain routing

Caddy listens on `:80` inside the LXC (TLS terminates at Cloudflare; the tunnel reaches Caddy over
the loopback). Routing for `martin.cam`:

| Path | Upstream | Notes |
|------|----------|-------|
| `/svc/*` | api `:4000` | Only new backend carve-out |
| `/ws` | realtime `:4002` | WebSocket upgrade (CF Tunnel supports WS) |
| everything else | web `:3001` | Next.js owns its full route tree, incl. `/cnet`, `/bd`, `/api/auth/*` |

Because the api mounts its tsoa routes at **root** today (`/proxmox`, `/metrics`, `/services`,
`/contact`, `/health`) and next-auth lives at `/api/auth/*` inside the Next app, the api is moved
behind a dedicated **`/svc`** prefix to avoid any collision with Next's `/api/*`. Page URLs
(`/cnet`, `/bd`, etc.) are unchanged — they fall through to the Next app exactly as before.

**Same-origin benefit:** with web, api, and realtime all served from `martin.cam`, there is **no
CORS** and the next-auth session cookie is shared with the api automatically — simpler than the
current cross-port local setup.

Required app config changes (small):

- `apps/api`: add tsoa `routePrefix: "/svc"` (regenerate routes).
- `NEXT_PUBLIC_API_URL=/svc` (same-origin relative base; `${API_BASE}/proxmox/vms` → `/svc/proxmox/vms`).
- `NEXT_PUBLIC_REALTIME_WS_URL=wss://martin.cam/ws`.
- `NEXTAUTH_URL=https://martin.cam`.
- `CORS_ORIGIN` becomes unnecessary in production (same-origin); keep for local dev.

### 5.5 Cloudflare Tunnel

- `cloudflared` runs as a service in the LXC, authenticated to the Cloudflare account, with a
  single public hostname `martin.cam` → `http://localhost:80` (Caddy).
- No inbound router ports; works behind dynamic home IP / CGNAT.
- Free Cloudflare WAF stays in front. **Cloudflare Access** (free) is recommended as a second gate
  on `/cnet/*` once Proxmox-control is live (see §7).

### 5.6 Neural bridge (unchanged code, repointed network)

- Stays on the PVE host where the Bluetooth radio is.
- Only change: `REDIS_URL` → `redis://<lxc-internal-ip>:6379` instead of localhost.
- Pub/sub contract (`bd:samples` / `bd:status`), framing, and the realtime fan-out are untouched.

---

## 6. CI/CD — Push-to-Deploy

### 6.1 Mechanism

- A **self-hosted GitHub Actions runner** runs as a `systemd` service inside the LXC (outbound
  connection only — same security shape as the tunnel; no exposed endpoint).
- Existing CI jobs (`bugcat`, `commitlint`, `format`, `lint`, `type-check`, `build`, `sonarqube`)
  continue to run on **GitHub-hosted runners**, unchanged.
- A new **`deploy`** job is added to `.github/workflows/ci.yml`:
  - `needs: [build]`
  - `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`
  - `runs-on: self-hosted`
  - runs `scripts/deploy.sh`.

### 6.2 `scripts/deploy.sh` (trigger-agnostic)

```
git pull --ff-only
bun install --frozen-lockfile
bunx turbo build
bunx turbo db:migrate --filter=@cnet/db   # apply any new migrations
sudo systemctl restart cnet-web cnet-api cnet-realtime cnet-workers
```

- The script never touches `/opt/cnet/.env`.
- Builds happen on the box (Next.js build is the heavy step — acceptable for a homelab).
- The runner's service account is granted narrowly-scoped `sudo` for the four `systemctl restart`
  commands only.

### 6.3 Rollback

- Re-run the workflow against an earlier commit, or `scripts/deploy.sh` after `git checkout <sha>`.
- LXC snapshot taken pre-cutover is the heavy-hammer fallback.

---

## 7. Future Integration Seams (design only — not built here)

The migration leaves these explicit seams so later work is additive:

### 7.1 Proxmox control

- New module in **`apps/api`** (e.g. `proxmox.controller.ts`) using the PVE API at
  `https://<pve-host>:8006` with the `PVEAPIToken` already documented in `docs/PROXMOX_SETUP.md`.
- The LXC reaches `:8006` over the internal Proxmox network.
- Endpoints (list / start / stop / reboot VMs & LXC, storage status) sit behind the existing
  next-auth session; surfaced under `/svc/proxmox/*` (the dashboard already calls `/proxmox/vms`).
- Least-privilege token per the existing setup guide.

### 7.2 Storage tanks as a personal cloud drive

- New `storage` module in **`apps/api`**, surfaced under `/svc/storage/*`.
- If the tanks are **ZFS datasets on the PVE host**: give the LXC a **bind mount**
  (`pct set <id> -mp0 /tank/path,mp=/mnt/tank`) and serve auth-gated browse / stream / upload.
- If the tanks are a **TrueNAS box**: use the TrueNAS API or an NFS/SMB mount instead.
- Large-file transfer is bounded by home upload bandwidth through the tunnel — acceptable; can add
  range requests / chunking later.

### 7.3 Security posture (becomes important once control is internet-reachable)

- next-auth Google allow-list (single account — you).
- **Cloudflare Access** (free) as a second authentication gate on `/cnet/*`.
- Least-privilege Proxmox token; Postgres/Redis never exposed beyond the internal network.
- Secrets only in the LXC `.env` (`chmod 600`), never committed.

---

## 8. Migration Plan (phased, reversible)

1. **Provision** — create + snapshot the LXC; install Bun/Node/Docker/Caddy/cloudflared/runner;
   bring up Postgres + Redis containers; clone repo to `/opt/cnet`; create `/opt/cnet/.env`.
2. **App config** — add tsoa `/svc` prefix; set the env vars from §5.4; write the four `systemd`
   units, `Caddyfile`, and `scripts/deploy.sh`.
3. **Data** — run `bun run db:migrate` against the LXC Postgres (fresh). *(Optional fallback: one
   `pg_dump` from the local dev container → `psql` restore if existing rows are wanted.)*
4. **Parallel run** — point the tunnel at a **staging hostname** (e.g. `staging.martin.cam`) while
   **Vercel still serves production `martin.cam`**. Validate: portfolio, `/cnet` auth + dashboard,
   `/bd`, api calls via `/svc`, WebSocket via `/ws`, Google OAuth callback, and the
   bridge → Redis → realtime path end-to-end.
5. **Cutover** — move the `martin.cam` route off Vercel onto the tunnel. Keep the Vercel project
   live a few days as a one-click rollback.
6. **Decommission** — delete the Vercel project once stable; finalize env vars; document the runbook.

---

## 9. What Explicitly Does Not Change

- Redis pub/sub channels and frame shapes (`bd:samples` / `bd:status`).
- The neural-bridge source.
- The realtime fan-out logic and BullMQ queues.
- The monorepo layout and existing CI checks.
- Page URLs (`/`, `/cnet`, `/bd`, `/api/auth/*`).

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Home upload bandwidth limits file streaming | Acceptable for personal use; add chunking/range later |
| Build-on-box CPU spikes during deploy | Homelab tolerance; builds are infrequent (push to main) |
| Proxmox control exposed to internet | next-auth + Cloudflare Access + least-privilege token |
| Self-signed PVE cert | "Verify SSL" toggle already handled per `docs/PROXMOX_SETUP.md` |
| LXC loses BLE access | Bridge intentionally stays on the host; only Redis URL changes |
| Bad deploy breaks prod | LXC snapshot + Vercel kept warm during cutover + git-checkout rollback |
```
