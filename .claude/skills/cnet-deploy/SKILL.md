---
name: cnet-deploy
description: Use when deploying, verifying, or debugging C-Net on the Proxmox box — shipping a change to martin.cam, checking whether a commit is live, reading prod logs, restarting cnet-web/api/realtime/workers, editing .env or Caddy/cloudflared config on the server, a "Deploy to Proxmox" job failing, or running the braindance/Muse neural bridge.
---

# C-Net deploy & box operations

C-Net runs on a self-hosted Proxmox node. This skill covers the round trip: edit locally,
push, let the box deploy itself, then verify from the box and the public edge.

**Core rule: code is edited only in the local workspace.** `/opt/cnet` on the box is a checkout
that `deploy.sh` fast-forwards — anything edited there is destroyed on the next deploy, and
editing it as root breaks the deploy runner outright (see Failure triage).

## The topology

| Thing | Where |
|---|---|
| Workspace (only place code is edited) | `C:\Users\Martin Cam\Downloads\code\C-Net` |
| Proxmox host | `root@192.168.1.67` — hostname `proxbox`, key auth, works headless |
| Website container | **LXC 110** (`website`), unprivileged, `nesting=1,keyctl=1` |
| App checkout | `/opt/cnet` inside CT 110, owned by `cnet:cnet` |
| Deploy runner | `actions.runner.martinlcam-C-Net.cnet-lxc`, runs **inside CT 110** as `User=cnet` |
| Services | `cnet-web` (3001), `cnet-api` (4000), `cnet-realtime` (4002), `cnet-workers`, `caddy`, `cloudflared` |
| Public URL | `https://martin.cam` |
| Braindance bridge | **PVE host**, not the container — see Braindance bridge |

## Reaching the box

`pct enter 110` is interactive and will hang a tool call. The scriptable equivalent:

```bash
ssh root@192.168.1.67 "pct exec 110 -- bash -lc '<command>'"
```

The command is two shells deep. Keep outer quotes double and inner single, and escape any `$`
that must survive to the container (`\$(...)`, `\${VAR}`) — unescaped, it expands on the
workstation and silently sends the wrong command.

For the PVE host itself (not the container), drop the `pct exec`: `ssh root@192.168.1.67 "<cmd>"`.

## Shipping a change

Push to `main` autonomously once the local gates pass — no need to ask first.

1. **Edit locally.** Never on the box.
2. **Gate it:** `bun run lint:check` and `bunx turbo build`. These mirror CI; failing them
   locally means the deploy will never run.
3. **Commit and push to `main`.** Deploy is gated on
   `github.ref == 'refs/heads/main' && github.event_name == 'push'`, so a PR branch does not
   deploy — only the merge (or a direct push) does.
4. **Watch it:** `gh run watch <run-id> --exit-status --interval 20`. The job graph is
   `bugcat` → `format`/`lint`/`type-check` → `build` → `Deploy to Proxmox`, so lint and types
   genuinely gate the deploy.
5. **Verify on the box** (below). A green Actions run is not proof the site is healthy.

`scripts/deploy.sh main` runs on the box: fetch → checkout → `bun install --frozen-lockfile`
→ `bunx turbo build` → `bun run db:migrate` → `systemctl restart cnet-web cnet-api cnet-realtime cnet-workers`.
It is `set -euo pipefail`, so it stops at the first failure and leaves the previous build running.

## Verifying a deploy

```bash
# Commit landed, tree clean?
ssh root@192.168.1.67 "pct exec 110 -- bash -lc 'cd /opt/cnet && git log --oneline -1 && git status --short'"

# Services up?
ssh root@192.168.1.67 "pct exec 110 -- bash -lc 'systemctl is-active cnet-web cnet-api cnet-realtime cnet-workers caddy cloudflared'"

# Smoke test inside-out, then the public edge
ssh root@192.168.1.67 "pct exec 110 -- bash -lc 'curl -sf localhost:4000/health; curl -so /dev/null -w \"web:%{http_code}\n\" localhost:3001'"
curl -so /dev/null -w '%{http_code}\n' https://martin.cam
```

Logs: `journalctl -u cnet-web -n 100 --no-pager` (or `-api`, `-realtime`, `-workers`, `caddy`,
`cloudflared`), all inside CT 110.

## Failure triage

| Symptom | Cause and fix |
|---|---|
| Deploy exits **128**, `insufficient permission for adding an object to repository database .git/objects` | Someone ran `git` as **root** in `/opt/cnet`, leaving root-owned objects the `cnet` runner cannot write. Fix: `chown -R cnet:cnet /opt/cnet`. Verify with `sudo -u cnet git fetch origin` before and after. |
| Actions green but site stale | Deploy job skipped — the push was to a branch, not `main`. |
| Build fails on the box | Reproduce locally with `bunx turbo build` and fix in the workspace. Never patch the box to make a build pass. |
| Service inactive after deploy | `journalctl -u cnet-<svc> -n 100 --no-pager`. Usually a missing key in `/opt/cnet/.env`. |
| Site down, services fine | Check `caddy` and `cloudflared`; the tunnel fronts everything. |
| Need to roll back | `sudo -u cnet /opt/cnet/scripts/deploy.sh <old-sha>` — see `docs/RUNBOOK-proxmox-deploy.md` §12. |
| Local `bunx turbo build` says `Unable to find package manager binary` | Workstation-only. Native turbo cannot see `bun.exe` because the Windows PATH is long enough to be truncated before it reaches `.bun\bin`. Keep `C:\Users\Martin Cam\.bun\bin` early in the User PATH; one-off workaround: `PATH="/c/Users/Martin Cam/.bun/bin:$PATH" bunx turbo build`. |

This failure mode is silent: deploys keep failing while the site looks fine, because the last
good build stays running. If the box's `HEAD` lags `origin/main`, check the deploy job's log
before assuming anything else.

## What may be changed on the box

Only state with no home in git: `/opt/cnet/.env`, `/etc/caddy/Caddyfile`,
`/etc/cloudflared/config.yml`, `/etc/systemd/system/cnet-*.service`. The last three have tracked
counterparts under `deploy/` — **change the repo copy too**, or the next runbook run reverts it.

Everything else is a code change and belongs in the workspace.

## Braindance bridge (Muse 2 EEG)

The bridge runs on the **PVE host**, *not* in CT 110, because the Bluetooth adapter is physically
there: `hci0`, Intel Wireless-AC 3168 (`8087:0aa7`), owned by the host's `bluetooth.service`.
It publishes to Redis `bd:samples` / `bd:status`; `apps/realtime` in CT 110 subscribes and fans
out to `/bd`.

```bash
ssh root@192.168.1.67
cd /root/C-Net && bun run bridge
```

**The `cd` is mandatory.** From `/root` there is no `package.json`, so `bun run bridge` falls
through to iproute2's `/usr/sbin/bridge` and prints network-bridge usage with exit **255**. That
error means the bridge never started — it is not a bridge failure.

Config is `/root/C-Net/.env` (`MUSE_ADDRESS`, `REDIS_URL`, `BD_*`); `neural_bridge/__main__.py`
loads it from the source path, not the cwd. It runs in the **foreground** — closing the SSH
session kills it, and there is no auto-restart or start-on-boot.

`/root/C-Net` is a stale checkout with uncommitted local edits and is deliberately outside the
deploy loop. Do not treat it as a place to make changes.

Turning this into a `cnet-bridge.service` on the host is the obvious upgrade — BlueZ and `hci0`
are already there, so no USB passthrough or privileged container is needed. A container or VM
would need the host's `bluetoothd` stopped or the adapter passed through, losing it host-side.

## Red flags — stop

- About to edit a file under `/opt/cnet` — that is a code change; make it locally.
- About to run `git commit`, `git pull`, or `git checkout` as root in `/opt/cnet`.
- About to `chown` away from `cnet:cnet` to make a command work.
- Reporting a deploy as successful having only seen the Actions run go green.

| Rationalization | Reality |
|---|---|
| "One-line fix, faster to edit on the server" | The next deploy overwrites it, and the fix exists nowhere. Minutes later it silently regresses. |
| "I'm already root on the box, just pull here" | That is exactly what broke the runner: root-owned `.git/objects`, every deploy failing at exit 128. |
| "Actions is green, it shipped" | Green `build` with a failed `deploy` looks identical from GitHub's summary. Check the box's `HEAD`. |
| "I'll sync it back to the repo later" | Untracked box edits have no diff and no history. Change the repo, then deploy. |
