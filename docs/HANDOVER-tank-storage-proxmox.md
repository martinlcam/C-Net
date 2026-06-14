# Handover: tank storage for C-Net (for the Proxmox-host Claude)

You run on the Proxmox host that serves Martin's website. C-Net (an LXC) now has a
**Vault** feature — per-user cloud file storage backed by tank main. **All app code is
done, tested, and on the `feat/vault-storage` branch** (API, multi-user roles, chunked
uploads, signed downloads, thumbnails, trash purge, reaper, and the web UI). Your job is
the **host-side** wiring the repo cannot do, plus reporting back a few facts only you can
see. **Do not touch app code.**

## What the app needs from the host (the contract)
- The C-Net LXC must have tank main bind-mounted at a path exposed to the app as
  `TANK_MOUNT_PATH`. The app stores every file under
  `${TANK_MOUNT_PATH}/cnet/users/<userId>/...` (flat by file id; folders are DB-only).
  That tree must be writable by the LXC's mapped uid/gid
- Per-user hard quota target: **1 TB** (some users differ — see `VAULT_ALLOWLIST`).
- The app already enforces a **soft** quota in code (blocks over-limit uploads, shows
  remaining space). You provide the **hard** filesystem backstop, if the host supports one.

---

## Step 1 — DISCOVER and REPORT BACK (do this first; do not assume)
These cannot be known from the repo. Run the commands, then send Martin/the main Claude
the **Report-back checklist** at the bottom.

```bash
# storage type + pool/dataset layout
zpool list ; zfs list            # ZFS?
vgs ; lvs                        # or LVM?
df -h                            # free space on the target pool

# the C-Net LXC and its config
pct list
pct config <id>                  # note existing mountpoints (mp0..mpN already used?)
grep -i unprivileged /etc/pve/lxc/<id>.conf   # unprivileged: 1  => host sets quotas
```
Why privilege matters: an **unprivileged** LXC **cannot** run `zfs set quota` itself, so the
quota backstop (Step 3) must run on the **host**, not inside the container.

## Step 2 — BIND MOUNT (prescribed; substitute discovered values)
```bash
# <host-tank-path> = the dataset/dir you chose on the host, e.g. /tank/cnet
# pick the next free mpN index from `pct config <id>`
pct set <id> -mp0 <host-tank-path>,mp=/mnt/tank
# create the base tree the app writes under, owned by the LXC's mapped root:
mkdir -p <host-tank-path>/cnet/users
# (unprivileged LXC: chown to the mapped uid, typically 100000)
chown -R 100000:100000 <host-tank-path>/cnet
```

## Step 3 — PER-USER QUOTA BACKSTOP (pick the branch matching Step 1)
ZFS (run on host):
```bash
zfs create <pool>/cnet/users/<userId>
zfs set quota=1T <pool>/cnet/users/<userId>
```
LVM thin fallback:
```bash
lvcreate -V 1T --thinpool <thinpool> -n cnet-<userId> <vg>
mkfs.ext4 /dev/<vg>/cnet-<userId>
mkdir -p <host-tank-path>/cnet/users/<userId>
mount /dev/<vg>/cnet-<userId> <host-tank-path>/cnet/users/<userId>   # add to /etc/fstab
```
`<userId>` is the C-Net user's UUID — get it from the admin **Users** view (`/admin/vault`)
or `select id, email from users;`. If neither mechanism exists, tell Martin: the app's soft
quota still applies, but there is no hard backstop.

## Step 4 — APP ENV + MIGRATION (inside the LXC, in C-Net's repo-root `.env`)
The app reads these (see `.env.example`):
```bash
TANK_MOUNT_PATH=/mnt/tank
# JSON allowlist: who can sign in, their role, and soft quota.
VAULT_ALLOWLIST=[{"email":"martin@example.com","role":"super"},{"email":"alice@example.com","role":"storage","quota":"1T"}]
VAULT_SIGNING_SECRET=        # optional; falls back to AUTH_SECRET if unset
VAULT_UPLOAD_TTL_HOURS=24    # abandoned-upload reaper window
VAULT_TRASH_TTL_DAYS=30      # trash purge window
```
Then apply the DB migration and restart services:
```bash
bun run db:migrate           # applies migration 0006 (vault tables) if not yet applied
# restart the api + workers (thumbnails/ffmpeg/pdftoppm optional — see below)
```
**Optional native tooling for thumbnails** (the worker degrades gracefully without them):
`sharp` ships with the app; install `poppler-utils` (for `pdftoppm`) and `ffmpeg` in the
LXC if you want PDF/video thumbnails. Image thumbnails work with no extra tooling.

## Step 5 — (OPTIONAL) Caddy direct-serve optimization
Downloads already stream with HTTP range support through the existing `/svc` route, so this
is **not required**. To take large transfers off the Node event loop, a commented
`handle_path /svc/vault/dl/*` block in `deploy/Caddyfile` serves bytes straight from
`TANK_MOUNT_PATH` after the API validates the signature (`GET /vault/_authz/*`). Enable only
if Caddy can read `TANK_MOUNT_PATH`.

## Verify
```bash
# inside the LXC, as the app user:
touch /mnt/tank/cnet/users/_probe && rm /mnt/tank/cnet/users/_probe   # writable?
# then in the UI: sign in -> /vault -> upload a file -> download it -> delete -> Trash
zfs get used <pool>/cnet/users/<userId>    # usage shows up (ZFS path)
```

---

## Report-back checklist (send these to the main Claude / Martin)
1. **Storage type**: ZFS or LVM (or plain dir)?
2. **Pool/dataset name** and **free space**.
3. **LXC id** and whether it's **privileged or unprivileged**.
4. **Chosen `TANK_MOUNT_PATH`** and the host path it maps to.
5. **Quota mechanism used** (zfs quota / lvm thin / none) and confirmation it's set.
6. Whether `poppler-utils` + `ffmpeg` were installed (PDF/video thumbnails on/off).
7. Any blockers (e.g. mp slots full, pool too small for 1 TB/user, permission issues).

## Out of scope (already done in the repo — do not touch)
Allowlist/roles, DB schema + migration files, upload/finalize endpoints, signed-URL
delivery, the `/vault/dl` byte server, the `/vault/_authz` target, the thumbnail/purge/reaper
workers, and the Vault + admin UI. All of that is implemented and committed.
