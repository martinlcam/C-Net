# Handover: tank storage for C-Net (for the Proxmox-host Claude)

You run on the Proxmox host that serves Martin's website. C-Net (an LXC) now has a
Vault feature that stores per-user files on disk. **The app code is done and tested.**
These are the **host-side** steps only you can perform — everything app-side is already
in the repo, so do **not** touch app code.

## Contract the app relies on
- The app reads `TANK_MOUNT_PATH` (env in the LXC's C-Net `.env`) and stores files under
  `${TANK_MOUNT_PATH}/cnet/users/<userId>/...`. That directory tree must be writable by
  the LXC's mapped uid/gid.
- Per-user hard quota target: **1 TB** (configurable; some users differ — the app's soft
  quota comes from `VAULT_ALLOWLIST`, see below).
- The app already enforces a **soft** quota in code (it blocks uploads over the limit and
  shows remaining space). Your job is the **hard** filesystem backstop, if the host
  supports one.

## Step 1 — DISCOVER (do this first; do not assume)
These cannot be known from the repo — find them on THIS host and **report back**:
- Storage type + pool name: `zpool list` / `zfs list` (ZFS?) vs `vgs` / `lvs` (LVM?).
- The C-Net LXC id and its config: `pct list`, then `pct config <id>`.
- Whether the LXC is **privileged or unprivileged**:
  `grep -i unprivileged /etc/pve/lxc/<id>.conf` (unprivileged: `unprivileged: 1`).
  **Unprivileged LXCs cannot run `zfs` quota commands themselves — the host sets quotas.**
- Free space on the target pool.

Report: the chosen `TANK_MOUNT_PATH`, the pool name, the storage type, and the LXC id.

## Step 2 — BIND MOUNT (prescribed; substitute the discovered pool path + LXC id)
```bash
# <host-tank-path> = the dataset/dir you chose on the host, e.g. /tank/cnet
pct set <id> -mp0 <host-tank-path>,mp=/mnt/tank
# then set TANK_MOUNT_PATH=/mnt/tank in the LXC's C-Net .env and restart the API/workers
```

## Step 3 — PER-USER QUOTA BACKSTOP (prescribed; pick the branch matching discovery)
ZFS:
```bash
zfs create <pool>/cnet/users/<userId>
zfs set quota=1T <pool>/cnet/users/<userId>
```
LVM (thin) fallback:
```bash
lvcreate -V 1T --thinpool <thinpool> -n cnet-<userId> <vg>
mkfs.ext4 /dev/<vg>/cnet-<userId>
mkdir -p <host-tank-path>/cnet/users/<userId>
mount /dev/<vg>/cnet-<userId> <host-tank-path>/cnet/users/<userId>
# add to /etc/fstab to persist
```
`<userId>` is the C-Net user's UUID (from the `users` table / the admin "Users" view).
If neither quota mechanism is available, tell Martin — the app still enforces the soft
quota in code, but there will be no hard backstop.

## Step 4 — (OPTIONAL) Caddy direct-serve optimization
The API already streams signed downloads with range support through the existing `/svc`
route, so this is **not required**. If you want large transfers to bypass the Node event
loop, there is a commented `handle_path /svc/vault/dl/*` block in `deploy/Caddyfile` that
serves files straight from `TANK_MOUNT_PATH` after the API validates the signature
(`GET /vault/_authz/*`). Only enable it if Caddy can read `TANK_MOUNT_PATH`.

## Out of scope (already done in the repo — do not touch)
Allowlist/roles, DB schema + migration, upload/finalize endpoints, signed-URL delivery,
the `/vault/dl` byte server, the `/vault/_authz` target, and (in a later plan) the Vault UI
and background workers.
