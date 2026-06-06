# C-Net → Proxmox Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-home the C-Net stack from Vercel to a self-hosted Proxmox LXC with a push-to-deploy pipeline, single-domain same-origin routing via Cloudflare Tunnel + Caddy, and clean seams for future Proxmox-control and storage features.

**Architecture:** App runs as native Bun processes under `systemd` in one Debian LXC; Postgres + Redis run as Docker containers in that same LXC. `cloudflared` makes an outbound tunnel to Cloudflare and points at a Caddy reverse proxy that path-routes the single `martin.cam` host (`/svc/*` → api, `/ws/*` → realtime, everything else → web). A self-hosted GitHub Actions runner in the LXC runs a containerless `git pull → build → migrate → restart` deploy on every push to `main`. The neural-bridge stays on the PVE host with its `REDIS_URL` repointed at the LXC's Redis.

**Tech Stack:** Bun, Turborepo, Next.js 16, Express/tsoa, BullMQ, Postgres 16, Redis 7, Docker Compose, Caddy, cloudflared, systemd, GitHub Actions (self-hosted runner).

**Spec:** `docs/superpowers/specs/2026-06-06-proxmox-migration-design.md`

**Refinements vs spec** (both reduce change surface; same design intent — single-domain same-origin):
- The api keeps serving its routes at root. **Caddy strips the `/svc` prefix** instead of adding a tsoa `routePrefix`. No api code change; local dev is untouched.
- The realtime WS is reached at `/ws/*`; **Caddy strips `/ws`** so the Bun server still sees its native `/bd/live` path, avoiding collision with the `/bd` page.

---

## File Structure

**Created in the repo (committed, version-controlled):**
- `scripts/deploy.sh` — containerless deploy script run by the self-hosted runner.
- `deploy/Caddyfile` — single-origin reverse proxy config.
- `deploy/compose.data.yml` — Postgres + Redis only (the LXC data services).
- `deploy/systemd/cnet-web.service`
- `deploy/systemd/cnet-api.service`
- `deploy/systemd/cnet-realtime.service`
- `deploy/systemd/cnet-workers.service`
- `deploy/.env.production.example` — documented production env template.
- `docs/RUNBOOK-proxmox-deploy.md` — operator guide for the manual/external setup.

**Modified in the repo:**
- `.github/workflows/ci.yml` — add the `deploy` job (self-hosted, `main` only).

**Created/changed on the Proxmox box only (NOT in git — done via the runbook):**
- The LXC itself, `/opt/cnet/.env`, installed runtimes, the Cloudflare Tunnel, the GitHub runner service, sudoers entry, and the host bridge's repointed `REDIS_URL`.

---

## PART A — Repository changes (agent-executable)

### Task 1: Deploy script

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Write the deploy script**

```bash
#!/usr/bin/env bash
# C-Net containerless deploy: pull -> build -> migrate -> restart.
# Run by the self-hosted GitHub Actions runner (or manually on the box).
# Usage: scripts/deploy.sh [git-ref]   (default ref: main)
set -euo pipefail

REPO_DIR="/opt/cnet"
REF="${1:-main}"
cd "$REPO_DIR"

# Export all env (incl. NEXT_PUBLIC_* which Next.js inlines at BUILD time) for build + migrate.
set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

echo "==> Fetching $REF"
git fetch origin
git checkout "$REF"
git pull --ff-only

echo "==> Installing dependencies"
bun install --frozen-lockfile

echo "==> Building"
bunx turbo build

echo "==> Applying DB migrations"
bun run db:migrate

echo "==> Restarting services"
sudo systemctl restart cnet-web cnet-api cnet-realtime cnet-workers

echo "==> Deployed $(git rev-parse --short HEAD)"
```

- [ ] **Step 2: Make it executable and verify it parses**

Run: `chmod +x scripts/deploy.sh && bash -n scripts/deploy.sh && echo OK`
Expected: prints `OK` (no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "[agent] feat(deploy): add containerless git-pull deploy script

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Caddy reverse-proxy config

**Files:**
- Create: `deploy/Caddyfile`

- [ ] **Step 1: Write the Caddyfile**

```caddyfile
# deploy/Caddyfile — single origin for the Cloudflare Tunnel.
# TLS terminates at Cloudflare; Caddy serves plain HTTP on :80 to cloudflared.
# reverse_proxy auto-upgrades WebSocket connections.
:80 {
	# Backend API: strip /svc, forward to Express (serves its tsoa routes at root).
	handle_path /svc/* {
		reverse_proxy 127.0.0.1:4000
	}

	# Realtime WebSocket: strip /ws, forward to the Bun WS server (serves /bd/live, /bd/ingest).
	handle_path /ws/* {
		reverse_proxy 127.0.0.1:4002
	}

	# Everything else -> Next.js (portfolio + /cnet + /bd + /api/auth/*).
	handle {
		reverse_proxy 127.0.0.1:3001
	}
}
```

- [ ] **Step 2: Verify formatting (if Caddy is available locally; otherwise skip)**

Run: `caddy fmt --diff deploy/Caddyfile 2>/dev/null || echo "caddy not installed locally - validate on the box"`
Expected: no diff, or the skip message.

- [ ] **Step 3: Commit**

```bash
git add deploy/Caddyfile
git commit -m "[agent] feat(deploy): add Caddy single-origin reverse proxy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Data-services compose (Postgres + Redis only)

**Files:**
- Create: `deploy/compose.data.yml`

- [ ] **Step 1: Write the compose file**

```yaml
# deploy/compose.data.yml — data services for the C-Net LXC.
# The app runs natively under systemd; only Postgres + Redis are containers.
# Reads POSTGRES_PASSWORD and REDIS_PASSWORD from the LXC's /opt/cnet/.env.
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    ports: ["127.0.0.1:5432:5432"]   # app connects via localhost only
    volumes: ["pg_data:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: cnet
      POSTGRES_USER: cnet
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    # Exposed on the LXC's interfaces so the host-resident neural-bridge can publish.
    # Keep restricted to the Proxmox internal network by host/PVE firewall — never via the tunnel.
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]

volumes:
  pg_data: { name: cnet_pg_data }
  redis_data: { name: cnet_redis_data }
```

- [ ] **Step 2: Validate YAML**

Run: `docker compose -f deploy/compose.data.yml config >/dev/null 2>&1 && echo OK || echo "validate on the box (docker not local)"`
Expected: `OK` or the skip message.

- [ ] **Step 3: Commit**

```bash
git add deploy/compose.data.yml
git commit -m "[agent] feat(deploy): add Postgres+Redis data compose for the LXC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: systemd unit files

**Files:**
- Create: `deploy/systemd/cnet-web.service`
- Create: `deploy/systemd/cnet-api.service`
- Create: `deploy/systemd/cnet-realtime.service`
- Create: `deploy/systemd/cnet-workers.service`

- [ ] **Step 1: Write `deploy/systemd/cnet-web.service`**

```ini
[Unit]
Description=C-Net Web (Next.js)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=cnet
WorkingDirectory=/opt/cnet/apps/web
EnvironmentFile=/opt/cnet/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Write `deploy/systemd/cnet-api.service`**

```ini
[Unit]
Description=C-Net API (Express/tsoa)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=cnet
WorkingDirectory=/opt/cnet/apps/api
EnvironmentFile=/opt/cnet/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Write `deploy/systemd/cnet-realtime.service`**

```ini
[Unit]
Description=C-Net Realtime (Bun WebSocket)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=cnet
WorkingDirectory=/opt/cnet/apps/realtime
EnvironmentFile=/opt/cnet/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Write `deploy/systemd/cnet-workers.service`**

```ini
[Unit]
Description=C-Net Workers (BullMQ)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=cnet
WorkingDirectory=/opt/cnet/apps/workers
EnvironmentFile=/opt/cnet/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 5: Commit**

```bash
git add deploy/systemd/
git commit -m "[agent] feat(deploy): add systemd units for web/api/realtime/workers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Production env template

**Files:**
- Create: `deploy/.env.production.example`

- [ ] **Step 1: Write the template** (copy to the LXC as `/opt/cnet/.env`, fill in real secrets)

```bash
# deploy/.env.production.example — copy to /opt/cnet/.env on the LXC, fill in real values, chmod 600.
# ---- Core ----
NODE_ENV=production

# ---- Public URLs (single-domain, same-origin) ----
# NEXT_PUBLIC_* are inlined by Next.js at BUILD time — they must be present when deploy.sh runs turbo build.
NEXT_PUBLIC_API_URL=/svc
NEXT_PUBLIC_REALTIME_WS_URL=wss://martin.cam/ws
NEXTAUTH_URL=https://martin.cam
CORS_ORIGIN=https://martin.cam

# ---- Auth ----
NEXTAUTH_SECRET=__generate__: openssl rand -base64 32
GOOGLE_ID=__from_google_cloud_console__
GOOGLE_SECRET=__from_google_cloud_console__

# ---- Data services (containers in this LXC) ----
POSTGRES_PASSWORD=__generate__: openssl rand -base64 24
REDIS_PASSWORD=__generate__: openssl rand -base64 24
DATABASE_URL=postgresql://cnet:__POSTGRES_PASSWORD__@127.0.0.1:5432/cnet
REDIS_URL=redis://:__REDIS_PASSWORD__@127.0.0.1:6379

# ---- Ports (defaults; keep aligned with Caddyfile) ----
API_PORT=4000
REALTIME_PORT=4002

# ---- Braindance / bridge channels (keep defaults to match the bridge) ----
BD_INGEST_KEY=__generate__: openssl rand -hex 16
BD_REDIS_CHANNEL_SAMPLES=bd:samples
BD_REDIS_CHANNEL_STATUS=bd:status

# ---- Email / integrations (carry over from current .env as needed) ----
RESEND_API_KEY=__optional__

# ---- Proxmox (future control module; token per docs/PROXMOX_SETUP.md) ----
PROXMOX_USER=
PROXMOX_TOKEN=
```

- [ ] **Step 2: Verify it has no real secrets**

Run: `grep -nE "=(sk-|AIza|[A-Za-z0-9]{32,})" deploy/.env.production.example || echo "no real secrets - OK"`
Expected: `no real secrets - OK`.

- [ ] **Step 3: Commit**

```bash
git add deploy/.env.production.example
git commit -m "[agent] feat(deploy): add production env template

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add the CI deploy job

**Files:**
- Modify: `.github/workflows/ci.yml` (append a new job after `build`)

- [ ] **Step 1: Append the deploy job** to the end of the `jobs:` map in `.github/workflows/ci.yml`

```yaml
  deploy:
    name: Deploy to Proxmox
    runs-on: self-hosted
    needs: [build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: Run deploy script on the box
        run: /opt/cnet/scripts/deploy.sh main
```

- [ ] **Step 2: Validate the workflow YAML**

Run: `bunx --yes yaml-lint .github/workflows/ci.yml 2>/dev/null || python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: `YAML OK` (or yaml-lint success).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "[agent] ci: add self-hosted deploy job for pushes to main

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PART B — Operator runbook (agent creates the doc; you execute it on the box)

### Task 7: Write the deployment runbook

**Files:**
- Create: `docs/RUNBOOK-proxmox-deploy.md`

- [ ] **Step 1: Write the runbook with the exact content below**

````markdown
# C-Net Proxmox Deployment Runbook

Operator guide for moving C-Net from Vercel to a self-hosted Proxmox LXC.
Work top-to-bottom. Commands run on the **PVE host shell** or **inside the LXC** as labelled.
Replace `martin.cam` only if your domain differs.

## 0. Prerequisites
- Proxmox node with internet access and a Debian LXC template available.
- A Cloudflare account managing `martin.cam` DNS (you already have this).
- A GitHub account with admin on the `C-Net` repo (for the self-hosted runner).
- Google Cloud OAuth client (you already have `GOOGLE_ID` / `GOOGLE_SECRET`).

## 1. Create the LXC  [PVE host]
1. Create an **unprivileged Debian 12 LXC** (e.g. CTID 110), 2 vCPU / 4 GB RAM / 20 GB disk,
   on `vmbr0`. Note its IP — call it `LXC_IP` below.
2. Enable nesting (needed to run Docker inside the LXC):
   ```bash
   pct set 110 -features nesting=1
   pct start 110
   pct enter 110
   ```

## 2. Install runtimes  [inside LXC]
```bash
apt update && apt -y upgrade
apt -y install curl git ca-certificates gnupg sudo

# Node (for app start scripts that call node) + build tooling
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs

# Docker (for Postgres + Redis only)
curl -fsSL https://get.docker.com | sh

# Caddy
apt -y install debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy

# cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# App service user
useradd --system --create-home --home-dir /home/cnet --shell /bin/bash cnet

# Bun (installed for the cnet user, symlinked to a system path for systemd)
sudo -u cnet bash -c 'curl -fsSL https://bun.sh/install | bash'
ln -sf /home/cnet/.bun/bin/bun /usr/local/bin/bun
bun --version   # sanity check
```

## 3. Clone repo + create .env  [inside LXC]
```bash
mkdir -p /opt/cnet && chown cnet:cnet /opt/cnet
sudo -u cnet git clone https://github.com/martinlcam/C-Net.git /opt/cnet
cd /opt/cnet
sudo -u cnet cp deploy/.env.production.example .env
chmod 600 .env && chown cnet:cnet .env
# Generate secrets and fill in .env (POSTGRES_PASSWORD, REDIS_PASSWORD, NEXTAUTH_SECRET, BD_INGEST_KEY,
# GOOGLE_ID/SECRET, RESEND_API_KEY, PROXMOX_*). Set DATABASE_URL/REDIS_URL to use those passwords.
nano .env
```

## 4. Start data services + migrate  [inside LXC]
```bash
cd /opt/cnet
set -a; source .env; set +a
docker compose -f deploy/compose.data.yml up -d
docker compose -f deploy/compose.data.yml ps      # both healthy?
sudo -u cnet bash -c 'set -a; source /opt/cnet/.env; set +a; bun install --frozen-lockfile && bun run db:migrate'
```

## 5. First build + install systemd units + Caddy  [inside LXC]
```bash
# First build (NEXT_PUBLIC_* must be in env for Next to inline them)
sudo -u cnet bash -c 'set -a; source /opt/cnet/.env; set +a; cd /opt/cnet && bunx turbo build'

# systemd units
cp /opt/cnet/deploy/systemd/cnet-*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cnet-web cnet-api cnet-realtime cnet-workers
systemctl status cnet-web cnet-api cnet-realtime cnet-workers --no-pager

# Caddy
cp /opt/cnet/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl restart caddy

# Local smoke test (before exposing publicly)
curl -fsS localhost:3001 >/dev/null && echo "web OK"
curl -fsS localhost:4000/health && echo "api OK"
curl -fsS localhost/svc/health && echo "caddy->api OK"
```

## 6. Cloudflare Tunnel  [inside LXC + Cloudflare dashboard]
```bash
cloudflared tunnel login                       # opens a URL; authorize martin.cam in the browser
cloudflared tunnel create cnet                 # note the Tunnel UUID + creds file path
cloudflared tunnel route dns cnet staging.martin.cam   # staging first (see step 9)
```
Create `/etc/cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: staging.martin.cam
    service: http://localhost:80
  - service: http_status:404
```
Install + start as a service:
```bash
cloudflared service install
systemctl enable --now cloudflared
systemctl status cloudflared --no-pager
```
> **Cloudflare dashboard:** confirm the `staging` (and later apex/`www`) DNS records are **Proxied**
> (orange cloud). Free WAF stays on. *(Optional, recommended later: Zero Trust → Access → add an
> application protecting `martin.cam/cnet*` as a second auth gate.)*

## 7. Google OAuth redirect  [Google Cloud Console]
Add these to the OAuth client's **Authorized redirect URIs** (so login works post-move):
- `https://staging.martin.cam/api/auth/callback/google`  (for validation)
- `https://martin.cam/api/auth/callback/google`           (for production)

## 8. Self-hosted GitHub Actions runner  [inside LXC + GitHub]
1. GitHub → repo **Settings → Actions → Runners → New self-hosted runner** (Linux x64). Copy the
   shown `./config.sh ... --token ...` command.
2. In the LXC:
   ```bash
   sudo -u cnet mkdir -p /home/cnet/actions-runner && cd /home/cnet/actions-runner
   # Download + extract per the GitHub page, then (as the cnet user) run the shown config:
   sudo -u cnet ./config.sh --url https://github.com/martinlcam/C-Net --token <TOKEN> --labels self-hosted
   ./svc.sh install cnet
   ./svc.sh start
   ```
3. Allow the runner to restart services without a password — create `/etc/sudoers.d/cnet-deploy`:
   ```
   cnet ALL=(root) NOPASSWD: /bin/systemctl restart cnet-web cnet-api cnet-realtime cnet-workers
   ```
   ```bash
   visudo -c -f /etc/sudoers.d/cnet-deploy   # validate
   ```

## 9. Repoint the neural-bridge  [PVE host — where the bridge runs]
Edit the bridge's environment so it publishes to the LXC Redis instead of localhost:
```
REDIS_URL=redis://:<REDIS_PASSWORD>@<LXC_IP>:6379
```
Restart the bridge. Confirm from the LXC that frames arrive:
```bash
docker exec -it $(docker ps -qf name=redis) redis-cli -a <REDIS_PASSWORD> SUBSCRIBE bd:samples
```
(Put on the headset / run the bridge; you should see frames.)

## 10. Staging validation  [browser]
Visit `https://staging.martin.cam` and verify:
- Portfolio renders at `/`.
- `/cnet` prompts Google login; sign-in succeeds and the dashboard loads.
- `/bd` connects (WS via `/ws`) and shows live frames when the bridge is running.
- Dashboard api calls succeed (Network tab shows `/svc/...` 200s).

## 11. Cutover  [Cloudflare dashboard + LXC]
1. Add the production hostname to `/etc/cloudflared/config.yml` ingress (above the 404):
   ```yaml
     - hostname: martin.cam
       service: http://localhost:80
     - hostname: www.martin.cam
       service: http://localhost:80
   ```
   `systemctl restart cloudflared`.
2. In Cloudflare DNS, **replace the existing `martin.cam` record that points to Vercel** with the
   tunnel route: `cloudflared tunnel route dns cnet martin.cam` (and `www` if used). Keep it Proxied.
3. Verify `https://martin.cam` serves from the box (check `journalctl -u caddy -f`).

## 12. Rollback & decommission
- **Fast rollback:** in Cloudflare DNS, point `martin.cam` back at Vercel (keep the Vercel project
  live for ~1 week post-cutover). App-level rollback: `sudo -u cnet /opt/cnet/scripts/deploy.sh <old-sha>`.
- **Heavy rollback:** restore the LXC snapshot taken before cutover.
- **Decommission:** once stable for a week, delete the Vercel project. Remove its env vars.

## Day-2 operations
- **Deploy:** push to `main` → watch the `Deploy to Proxmox` job in GitHub Actions.
- **Logs:** `journalctl -u cnet-web -f` (or `-api` / `-realtime` / `-workers`), `journalctl -u caddy -f`.
- **Manual deploy:** `sudo -u cnet /opt/cnet/scripts/deploy.sh main`.
- **Data backup:** `docker exec cnet-postgres pg_dump -U cnet cnet > backup-$(date +%F).sql` (run on the box).
````

- [ ] **Step 2: Verify the doc has no unresolved placeholders for the agent** (the `<...>` tokens are intentional operator fill-ins)

Run: `grep -nE "TBD|TODO|FIXME" docs/RUNBOOK-proxmox-deploy.md || echo "no agent placeholders - OK"`
Expected: `no agent placeholders - OK`.

- [ ] **Step 3: Commit**

```bash
git add docs/RUNBOOK-proxmox-deploy.md
git commit -m "[agent] docs: add Proxmox deployment runbook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PART C — Optional data carry-over (only if you want existing local rows)

### Task 8: (Optional) Migrate local DB rows

**Files:** none (operational).

- [ ] **Step 1: Dump the local dev DB** (on your Windows dev machine, with `bun run db:start` running)

Run: `docker exec cnet_pg_data pg_dump -U cnet cnet > cnet-local.sql`
Expected: a `cnet-local.sql` file. *(If the container name differs, find it via `docker ps`.)*

- [ ] **Step 2: Restore into the LXC Postgres** (copy the file to the LXC first)

Run: `cat cnet-local.sql | docker exec -i $(docker ps -qf name=postgres) psql -U cnet -d cnet`
Expected: restore completes without errors. Skip entirely if you're fine re-logging in fresh.

---

## Self-Review

**Spec coverage:**
- §3 decisions (LXC, native+systemd, PG/Redis containers, tunnel, Caddy, single-domain, git-pull, self-hosted runner, bridge stays, no data migration) → Tasks 1–7 + runbook steps 1–9. ✔
- §5.4 single-domain routing → Task 2 (Caddyfile) + runbook step 5/10. ✔ (refined: Caddy strip vs tsoa prefix — documented above.)
- §6 CI/CD → Tasks 1 & 6 + runbook step 8. ✔
- §7 future seams → unchanged code; api stays at root, `/svc` available for new modules; storage bind-mount noted in spec (not built). ✔
- §8 phased migration (provision→config→data→parallel→cutover→decommission) → runbook steps 1–12. ✔
- §5.6 bridge repoint → runbook step 9. ✔

**Placeholder scan:** No agent-facing TBD/TODO. Operator fill-ins use explicit `<UPPER_CASE>` / `__generate__` tokens with the command to produce them.

**Type/name consistency:** Service names (`cnet-web/api/realtime/workers`), ports (web 3001 / api 4000 / realtime 4002), paths (`/svc` strip → api root, `/ws` strip → `/bd/live`), and env var names (`NEXT_PUBLIC_API_URL=/svc`, `NEXT_PUBLIC_REALTIME_WS_URL=wss://martin.cam/ws`) are consistent across the deploy script, Caddyfile, systemd units, env template, and runbook.
