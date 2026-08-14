# Local → Proxmox deploy loop

How a change travels from this workstation to the running site, and how to check it landed.

Code is only ever edited **in the local workspace**. The box is never a place to write code —
`/opt/cnet` is a checkout that `deploy.sh` fast-forwards, so anything edited there is lost on the
next deploy.

## The loop

1. **Edit locally** in the workspace, then gate it: `bun run lint:check` and `bunx turbo build`.
2. **Push to `main`.** The `deploy` job in `.github/workflows/ci.yml` is gated on
   `github.ref == 'refs/heads/main' && github.event_name == 'push'` and `needs: [build]`, so
   nothing reaches the box until the build job is green.
3. **The self-hosted runner picks it up.** It runs *inside* LXC 110 as the `cnet` user
   (`actions.runner.martinlcam-C-Net.cnet-lxc`) and executes `/opt/cnet/scripts/deploy.sh main`:
   fetch → checkout → `bun install --frozen-lockfile` → `bunx turbo build` → `bun run db:migrate`
   → `systemctl restart cnet-web cnet-api cnet-realtime cnet-workers`.
4. **Verify on the box** (see below).

## Reaching the box

The site runs in an **unprivileged LXC (CTID 110, `website`)** on the Proxmox node `proxbox`
at `192.168.1.67`. There is no direct SSH into the container — you hop through the PVE host.

Interactively:

```bash
ssh root@192.168.1.67
pct enter 110
```

Non-interactively (scriptable — this is what tooling should use):

```bash
ssh root@192.168.1.67 "pct exec 110 -- bash -lc '<command>'"
```

Quoting matters: the command is nested two shells deep. Keep the outer quotes double and the
inner single, and escape any `$` that must survive to the container.

## Verifying a deploy

```bash
# Did the commit land, and is the tree clean?
ssh root@192.168.1.67 "pct exec 110 -- bash -lc 'cd /opt/cnet && git log --oneline -1 && git status --short'"

# Are the services up?
ssh root@192.168.1.67 "pct exec 110 -- bash -lc 'systemctl is-active cnet-web cnet-api cnet-realtime cnet-workers caddy cloudflared'"

# Smoke tests, inside-out
ssh root@192.168.1.67 "pct exec 110 -- bash -lc 'curl -sf localhost:4000/health; curl -so /dev/null -w \"web:%{http_code}\n\" localhost:3001; curl -so /dev/null -w \"caddy:%{http_code}\n\" localhost/svc/health'"

# ...and from the public edge
curl -so /dev/null -w '%{http_code}\n' https://martin.cam
```

Logs live in the journal: `journalctl -u cnet-web -n 100 --no-pager` (or `-api`, `-realtime`,
`-workers`, `caddy`, `cloudflared`).

## What may be changed on the box

Only state that has no home in git: `/opt/cnet/.env`, `/etc/caddy/Caddyfile`,
`/etc/cloudflared/config.yml`, `/etc/systemd/system/cnet-*.service`. The last three have tracked
counterparts under `deploy/` — change the repo copy too, or the next person to run the runbook
gets the old behaviour.

Everything else is a code change and belongs in the workspace.

## When a deploy fails

`deploy.sh` is `set -euo pipefail`, so it stops at the first failing step and leaves the previous
build running. Read the runner's log for the failing step, reproduce it locally, fix it in the
workspace, and push again. Rolling back is
`sudo -u cnet /opt/cnet/scripts/deploy.sh <old-sha>` — see
[RUNBOOK-proxmox-deploy.md](./RUNBOOK-proxmox-deploy.md) §12.
