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
