# ZFS Pools & 12-Bay GUI — Implementation Plan

Status: **Phase 1 BUILT** (read-only GUI) · Target page: `apps/web/app/cnet/dashboard/infrastructure/proxmox`
Host node: **proxbox** · App runtime: **LXC 110** (`/opt/cnet`, Bun/Turbo/Next)

> **Phase 1 implemented 2026-06-16** — read-only GUI off PVE REST. Engine + API
> typecheck clean; mappers verified against live `pvesh` data (12-bay view matches
> calibration, KGFQ's 64 pending sectors surface, pools show raidz3/mirror). Files:
> - engine: `proxmox/storage-types.ts`, `proxmox/bay-map.ts` (calibrated map),
>   `proxmox/storage.ts` (pure mappers), `proxmox/service.ts` (+disks/zfs/smart calls)
> - api: `controllers/storage.controller.ts` (`/proxmox/storage/{bays,pools,disks/:serial/smart}`,
>   `superuser` scope), `middleware/auth.middleware.ts` (+superuser gate)
> - web: `components/storage/*` (Backplane, Bay, PoolCard, DriveDetail, StorageView),
>   proxmox `page.tsx` → Storage tab (default) + VMs tab
>
> **To go live, set in env (LXC 110):** `CNET_STORAGE_PVE_HOST`, `CNET_STORAGE_PVE_USER`,
> `CNET_STORAGE_PVE_TOKEN` (PVE token w/ `Sys.Audit` + `Datastore.Audit` on proxbox),
> optional `CNET_STORAGE_PVE_NODE` (default `proxbox`). Until set, endpoints return 503.
>
> **Gotchas found while building:** (1) tsoa can't resolve engine types across the
> workspace, so controller payloads are typed `{ data: unknown }` (matches existing
> `proxmox.controller`). (2) PVE nests the ZFS tree `root → poolname → vdev → leaves`,
> so the vdev type is 2 levels deep — `deriveRaid` searches for it. (3) App-wide
> client→API auth is a pre-existing gap (the VM page has it too); storage lights up
> end-to-end once that's resolved.

## 0. Decisions (locked 2026-06-16)

| # | Decision | Choice |
| --- | --- | --- |
| Access | Gating | **Reuse existing allowlist superuser** (`isEmailAuthorized`, server-side). No DB role column, no migration. Add `requireSuperuser` in API; page behind existing `requireAuthorizedEmail`. |
| Creds | PVE token | **Single global service token** in env (not per-user `infrastructureConfigs`). One admin forever. |
| UI | Page model | **Storage backplane is the MAIN Proxmox view.** VMs/containers move to a **secondary tab** on the same page. |
| UI | Bay layout | **3 rows × 4 cols** (bays 1–4 / 5–8 / 9–12), front view. |
| UI | Visual | **Custom "cool" SVG**, modeled on a real head-on chassis photo (user to provide). Must live-toggle occupied/empty as drives are pulled/inserted. |
| Actions | Scope | **Full**, incl. `zpool replace/online/offline/scrub` + locate + spindown — all audit-logged. |
| Actions | Spindown | **cold_tank / idle drives only.** Disable/hide for active tank_main raidz3 members. |
| Actions | Destructive gate | `zpool replace/offline/online`: **(1)** blink target LED + visually confirm, **(2)** type full serial, **(3)** enter a dedicated op password — **`CNET_STORAGE_OP_PASSWORD`**, hashed (argon2/bcrypt) at rest in host/API env, verified server-side, separate from login. Rarely used — emergency path when SSH unavailable. |
| Live | `/bay/live` WS | **Token-gated.** API issues a short-lived token only to a superuser session. |
| Alerts | Faults | **In-app banner only** (red bay + banner on DEGRADED/FAULTED/FAILED/new pending sectors). No push/email. |
| Data | History | **Record per-drive SMART/health over time** via existing metrics-collector → `metricsSnapshots`; show sparklines in drive detail. |
| Data | Drive fields | Identity (serial/model/size/by-id/pool/bay); temperature; power-on hours + start/stop cycles (SMART 9/4/12); pending/reallocated sectors + read/write error rates (SMART 5/197/198). **Plus:** live read/write throughput, negotiated SATA link speed, ZFS per-vdev read/write/cksum counters, last self-test result, firmware. |
| Map | bayMap | **Interactive calibration now** — blink each HBA bay via `ledctl`, user reports which physical slot lit; AHCI 4 hand-mapped by position. Result frozen as static `serial → bayIndex`. |

## 1. Goal

Add a storage section to the Proxmox page that renders the physical server as a
**12-bay backplane graphic**. Each bay shows:

- occupied / empty
- pool membership (tank_main vs cold_tank vs boot/none)
- spun-up vs spun-down (standby)
- live IO activity (the "blink") + software locate-LED state
- per-drive fault state (degraded / resilvering / pending sectors / SMART health)

Plus a per-pool header: pool state (ONLINE/DEGRADED), raidz layout, capacity,
scrub/**resilver progress**.

## 2. Architecture (decided)

Live status flows over the **existing** `apps/realtime` Redis→WS fan-out. Action
verbs (locate/spindown/zpool) go over a **unix socket** bind-mounted into LXC 110.
No root-capable verbs over TCP.

```
proxbox HOST                                LXC 110 (C-Net)
┌─────────────────────────────┐             ┌──────────────────────────────┐
│ cnet-bayd (Bun daemon)      │   Redis     │ apps/realtime (exists)       │
│  • zpool + diskstats poll   │  PUBLISH    │   Redis SUB → WS fan-out     │──WS──▶ web
│  • PUBLISH bay:status ──────┼──pub/sub───▶│   (add bay:status channel)   │       12-bay
│                             │             │                              │       graphic
│  • REST verbs over          │  AF_UNIX    │ apps/api proxmox.controller  │
│    /run/cnet-bayd.sock  ◀───┼─────────────┤   proxies verbs to socket    │◀─REST─ actions
└─────────────────────────────┘             └──────────────────────────────┘
        ▲ reads /dev, zpool, ledctl                 ▲ also: slow reads via PVE REST :8006
```

Redis is already shared (`REDIS_URL=redis://…@192.168.1.84:6379`); the host can
reach it over the LAN bridge, so `cnet-bayd` only needs `REDIS_URL` + the socket.

## 3. What comes from where

| Data | Source | Cost |
| --- | --- | --- |
| Drive identity (serial, model, size, wwn, by-id, health) | PVE REST `GET /nodes/proxbox/disks/list` | poll, cheap |
| SMART (power-on hrs, **start/stop cycles**, pending sectors) | PVE REST `GET /nodes/proxbox/disks/smart?disk=…` | poll, slow — cache |
| Pool tree + **resilver/scrub %** + vdev state | PVE REST `GET /nodes/proxbox/disks/zfs/{pool}` | poll |
| Live IO "blink" | host agent — `/proc/diskstats` deltas | stream (Redis) |
| Spin state (active/standby) | host agent — `hdparm -C` / `smartctl -n standby` | stream (Redis) |
| Locate-LED on/off | host agent — `ledctl locate=/dev/sdX` | command |
| Spin down / up | host agent — `hdparm -y` / read poke | command |
| `zpool replace/online/offline`, scrub | host agent | command |

**Nothing physical is reachable from inside 110** (no `/dev/sd*`, no `zpool`, no
`ledctl`). PVE REST is poll-only (no SSE/WS except console).

## 4. Hardware ground truth (captured 2026-06-16)

Controller split (from `lsblk HCTL` + by-id):

| Controller | Bays | HCTL | LED control | Pool |
| --- | --- | --- | --- | --- |
| LSI SAS2308 HBA (mpt3sas) | 8 | host `4:*` | **real** `ledctl` locate (SGPIO) | tank_main (8-wide raidz3) |
| AMD FCH AHCI | 4 | host `2:*`,`5:*` | **none** (AHCI EM unsupported) — activity LED only | cold_tank (2-way mirror) |
| M.2 SATA (mobo) | — | host `16:*` | n/a | boot SSD (`sdm`, not a hot-swap bay) |

Current population (serial → dev → pool):

```
tank_main (raidz3, all on HBA):
  ZA13ETKN sdb  ZA13HXER sdc  ZA13EQFX sdd  ZA13JWV9 sde
  ZA13JX1J sdf  ZA13JWVH sdg  ZA13JWR6 sdh  ZA13ETCS sda
cold_tank (mirror, AHCI):
  ZA13KGFQ sdi (~64 pending sectors — watch)   ZA13EK55 sdk
boot: SanDisk M.2 sdm
```

### 4a. bayMap — calibrated 2026-06-16 (HBA via ledctl, interactive)

Layout 3×4, front view. **Top 8 = HBA/tank_main (locate-capable). Bottom 4 =
AHCI/cold_tank (no locate).** Note the backplane renders `ledctl locate` as a
**red rapid blink** (dumb SGPIO; no separate blue locate LED) — UI must label it
so it isn't mistaken for a fault.

```
bay  1: ZA13JWR6 (sdh)   2: ZA13JWVH (sdg)   3: ZA13JX1J (sdf)   4: ZA13JWV9 (sde)
bay  5: ZA13EQFX (sdd)   6: ZA13HXER (sdc)   7: ZA13ETKN (sdb)   8: ZA13ETCS (sda)
bay  9: ZA136AR3(no-link) 10: <empty>        11: ZA13EK55 (sdk)  12: ZA13KGFQ (sdi)
        bay 9 = ZA136AR3 seated but NOT enumerated (loose/no SATA link); occupied-offline
        bay 10 = empty (former ZA13KGPD slot); 11+12 = cold_tank mirror
```

HBA pattern is a clean reverse of `sd*` order (bay1=sdh … bay8=sda) but we key the
map by **serial** (stable across reboots/dev renames), not dev path. Bays 11/12
mapped via the read-IO activity-LED trick (`dd if=/dev/sdX of=/dev/null` → watch
which bay flickers): bay 12 flickered on `sdi` read → `ZA13KGFQ`=12, `ZA13EK55`=11.

**AHCI occupancy edge case:** bay 9 holds a drive that won't link, so it never
appears in `disks/list` / `/dev`. Software-only occupancy detection would wrongly
show it **empty**. To render "occupied but offline/no-link" the agent must parse
SATA port link state (`/sys/class/ata_port/*`, `ata*` link status) for the 4 AHCI
bays, not rely on enumeration alone. HBA bays don't have this problem.
Pragmatic fallback (since the bayMap is static anyway): flag bay 9 as
`occupied-offline` in the map until that drive is pulled/replaced; treat runtime
SATA-link parsing as best-effort. Kernel split confirmed: `host4 = mpt2sas` (8 HBA
bays), all other `ata*`/`host*` = `ahci` (4 bottom bays + boot M.2).

### 4b. Later item — `bun run calibrate:bays` script

Automate exactly the process we did by hand:
- Enumerate HBA drives (by-id `ata-*` on the mpt3sas host); for each: `ledctl
  locate=on`, prompt "which bay (1–12)?", record serial→bay, `locate=off`.
- For AHCI / non-LED drives: trigger read IO (`dd … iflag=direct count=200`) and
  ask which **activity** LED flickered → record position.
- Write `serial → bayIndex` JSON (+ controller, ledCapable) to a file the API and
  `cnet-bayd` both read. Idempotent / re-runnable whenever drives are moved.
- Lives on the host (needs `/dev` + `ledctl`); ship alongside `cnet-bayd`.

> **Calibration step required:** HBA `HCTL` phy numbers (`4:0:1` … `4:0:15`) do
> **not** map linearly to physical slot order (e.g. `sda` is `4:0:15`). Before
> shipping the bay graphic we must blink each LED one at a time and record which
> physical bay lights, producing a static `bayMap: serial → bayIndex`. The 4
> AHCI bays get no locate, so map them by enclosure position manually.

UI must render the 4 AHCI bays as **"locate unavailable / activity-only"** — do
not show a locate button that can't work.

## 5. Data contracts

New shared types (suggest `packages/engine/src/proxmox/storage-types.ts`,
re-exported from engine index):

```ts
export interface BayInfo {        // static-ish, from PVE disks/list + bayMap
  bayIndex: number                // 0..11 physical slot
  controller: "hba" | "ahci"
  ledCapable: boolean
  occupied: boolean
  serial?: string
  model?: string
  sizeBytes?: number
  byIdLink?: string
  devPath?: string                // not exposed to client; agent-side only
  pool?: "tank_main" | "cold_tank" | "boot" | null
  smartHealth?: "PASSED" | "FAILED" | "UNKNOWN"
}

export interface PoolStatus {     // from disks/zfs/{pool}
  name: string
  state: "ONLINE" | "DEGRADED" | "FAULTED" | "OFFLINE"
  raid: string                    // "raidz3" | "mirror"
  capacity: { used: number; total: number }
  scan?: { kind: "resilver" | "scrub"; percent: number; etaSec?: number }
  vdevs: { serial: string; state: string; read: number; write: number; cksum: number }[]
}

// live frame on Redis channel `bay:status`, fan-out via realtime WS
export interface BayLiveFrame {
  t: "bay"                        // realtime server keys broadcast on `t`
  ts: number
  bays: {
    serial: string
    spin: "active" | "standby" | "unknown"
    ioActive: boolean             // diskstats delta > 0 this tick
    locate: boolean
  }[]
  resilver?: { pool: string; percent: number }
}
```

Note: `apps/realtime/server.ts` currently routes ingest by `t === "status" | "sample"`.
Add a `bay` case (or a dedicated `BAY_REDIS_CHANNEL=bay:status` and subscribe it
in `startBus([...])`). Agent publishes straight to Redis, so the ingest-WS path
isn't strictly needed — just add `bay:status` to the subscriber channel list and
broadcast as-is. Viewer endpoint: add `/bay/live` (or reuse a generic topic).

## 6. Phase 1 — read-only GUI (no host agent)

Delivers ~80% of the visual value purely from PVE REST.

**Backend (`apps/api` + `packages/engine`):**
- Extend `ProxmoxService` with:
  - `getDisks()` → `GET /nodes/{node}/disks/list`
  - `getDiskSmart(dev)` → `GET /nodes/{node}/disks/smart` (cache ~5 min)
  - `getZfsPool(name)` / `listZfs()` → `GET /nodes/{node}/disks/zfs[/{name}]`
- Map results → `BayInfo[]` + `PoolStatus[]` using a static `bayMap` const
  (from calibration). Keep `devPath` server-side only.
- New controller routes (JWT, like existing): `GET /proxmox/storage/bays`,
  `GET /proxmox/storage/pools`, `GET /proxmox/storage/disks/{serial}/smart`.

**Frontend (`apps/web`):**
- New component dir `components/storage/`: `Backplane.tsx` (SVG 12-slot grid in
  physical layout), `Bay.tsx` (one slot — occupied/empty, pool color, badges),
  `PoolCard.tsx` (state + capacity + resilver bar).
- New section on the proxmox page (tab or below VM list) using react-query
  `refetchInterval` (~10s) against the new routes. Pure poll for Phase 1.
- Drive a Storybook story per component (repo already uses `stories/`).

**Acceptance:** bays render in correct physical order, occupancy + pool coloring
correct, tank_main shows raidz3/ONLINE + capacity, SMART health badge on each
drive, cold_tank shows the pending-sector warning on `ZA13KGFQ`.

## 7. Phase 2 — `cnet-bayd` host agent (live status)

New deployable that runs on **proxbox host** (systemd unit), NOT in the monorepo
container. Suggest `apps/bayd/` (Bun, single file) so it shares types via the
workspace but is built/shipped to the host separately.

Responsibilities:
- Every ~1s: read `/proc/diskstats`, diff per device → `ioActive`.
- Every ~10s: `hdparm -C /dev/sdX` (or `smartctl -n standby`) → spin state
  (cheap; do NOT poke standby drives awake — `-C` with `-n standby` is safe).
- Watch `zpool status` (or PVE) for resilver % when DEGRADED.
- `PUBLISH bay:status` `BayLiveFrame` to shared Redis.

`apps/realtime`: subscribe `bay:status`, expose `/bay/live` WS. Web subscribes,
swaps Phase-1 poll for live blink/spin/resilver.

Deployment: build `bayd` → copy binary + `bayMap` to host → systemd service with
`REDIS_URL`. Runs as root (needs `/dev`, `ledctl`, `hdparm`).

## 8. Phase 3 — action verbs (unix socket)

`cnet-bayd` exposes a tiny REST server bound to `AF_UNIX` at
`/run/cnet-bayd.sock`, bind-mounted into LXC 110 (`pct set 110 -mp0 ...` or a
lxc mount entry). Verbs:

| Verb | Impl | Guard |
| --- | --- | --- |
| `POST /locate {serial,on}` | `ledctl locate[=off]=/dev/sdX` | HBA bays only |
| `POST /spindown {serial}` | `hdparm -y /dev/sdX` | confirm not in active IO |
| `POST /zpool/replace {pool,old,new}` | `zpool replace …` | typed-confirm in UI |
| `POST /zpool/online|offline` | `zpool …` | |
| `POST /scrub {pool}` | `zpool scrub …` | |

- `apps/api` `proxmox.controller` gains matching JWT routes that proxy to the
  socket and wrap every call in `logAuditAction` (pattern already used for VM
  start/stop). The socket itself has **no auth** — security is: not on TCP +
  filesystem perms + only API container can see the mount.
- Destructive verbs (replace/offline) require a typed-serial confirm in the UI.

## 9. Risks / open questions

1. **bayMap calibration** — must physically blink-and-look once; AHCI bays
   hand-mapped. Wrong map = drive shown in wrong bay (cosmetic but misleading
   during a real swap).
2. **PVE token scope** — does the per-user `infrastructureConfigs` token have
   `Sys.Audit`/`Datastore` perms for `disks/*`? Verify before Phase 1.
3. **SMART poll cost** — `disks/smart` spins up standby drives; cache hard and
   never call it on a drive the agent reports as `standby`.
4. **Multi-tenant** — storage is host-global, not per-user. Decide whether the
   bay GUI is admin-only (likely yes) vs per-user config like VMs.
5. **Socket lifecycle** — agent must `chmod`/own the socket so only the API
   process uid in 110 can write; recreate on restart.

## 10. Suggested order

1. Phase 1 backend routes + `bayMap` calibration + Backplane UI (poll).
2. `cnet-bayd` status-only + realtime `bay:status` + swap UI to live.
3. Action verbs over socket, starting with locate (safest), then spindown,
   then zpool ops behind typed confirms.
