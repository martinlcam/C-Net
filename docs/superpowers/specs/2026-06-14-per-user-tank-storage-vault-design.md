# Per-User Tank Storage Vault — Design

**Date:** 2026-06-14
**Status:** Approved design, pre-implementation
**Reference design:** `futurity-1` Vault (`apps/web/app/dashboard/vault`, `packages/engine/src/v2/object-storage`)

## Overview

Add a personal cloud-storage **Vault** to C-Net, backed by the Proxmox host's ZFS
storage ("tank main") rather than S3. C-Net becomes lightly multi-user: the existing
single owner is a **superuser** with the full dashboard, and additional invited
people get **storage-only** accounts that can use the Vault and nothing else, each
with a configurable per-user quota (default target 1 TB).

The Vault's UI and data model are ported from the `futurity-1` Vault. The backend is
**rebuilt in C-Net's idiom** (Express + tsoa + Drizzle + BullMQ) because Futurity is
Elysia/Eden/S3 and cannot be copied verbatim. The S3 storage layer is replaced by a
local filesystem layer over the bind-mounted tank.

### Goals
- Authenticated (Google OAuth) per-user file storage on tank main.
- Two roles: `super` (full dashboard + admin over all vaults) and `storage` (Vault only).
- Per-user quota, configurable per user, enforced in-app with a host-level backstop.
- Chunked + resumable uploads suitable for multi-GB files over a home uplink.
- Trash (soft-delete), star/color tags, filename search, thumbnails (images/PDF/video).

### Non-goals (v1)
- Cross-user or public sharing (every vault is private to its owner; superuser can browse all).
- Semantic/vector search, WebDAV mounting, Collabora online editing.
- Object storage (S3/MinIO). The storage-adapter seam leaves room to add it later.

## Architecture decisions

| Decision | Choice |
| --- | --- |
| Backend structure | **Storage-adapter seam** in `@cnet/engine`: a `StorageAdapter` interface with one `FilesystemAdapter` impl. Controllers never touch `fs` directly. |
| Multi-user gate | Replace the single hard-coded email with an **allowlist config** (source of truth, read live by email per request). |
| Roles | `super` and `storage`, derived live from the allowlist — no `role`/`quota` columns on `users`. |
| File delivery | **Signed short-lived URLs served by Caddy** with HTTP range support; bytes bypass the Node process. |
| Uploads | **Chunked + resumable**, tracked in a dedicated `vault_uploads` session table; reaped if abandoned. |
| Admin override | Isolated to a dedicated `AdminVaultController`; shared endpoints never read a caller-supplied user id. |
| Quota enforcement | **App-level accounting** for UX + pre-flight rejection; **hard ZFS/LVM backstop deferred to the proxmox-claude** via a handover doc. |
| Thumbnails | BullMQ worker: `sharp` (images) + PDF first-page raster + `ffmpeg` (video poster). |
| Superuser scope | Superuser can browse/download/delete **any** user's vault via an admin path. |

## 1. Roles & access

The single allowed email (`packages/core/src/authorization.ts`, `apps/web/lib/auth.config.ts`)
is replaced by an allowlist config — env var or committed config file — of the shape:

```ts
type AllowlistEntry = {
  email: string
  role: "super" | "storage"
  quota: string | null   // e.g. "1T", "500G"; null = unlimited (super)
}
```

- The `signIn` callback rejects any email not in the allowlist (same gate, now a list).
- `role` and `quota` are resolved **live from the allowlist by email** on each request, so
  editing a line takes effect without a DB migration or write. No new columns on `users`.
- **Web routing:** a `storage` user is redirected to `/vault` and away from every other
  dashboard route (Proxmox, metrics, services, BFIDA, deployment, admin).
- **API authorization:** non-vault tsoa controllers require `role === "super"`; vault
  controllers allow any allowlisted user but scope every query to `ownerUserId === user.id`.
  The admin vault path additionally allows `super` to target any `userId`.

Adding a person = add a line to the allowlist + (for the hard quota backstop) the
proxmox-claude provisions their dataset. No admin UI is built in v1.

## 2. Data model

Ported from Futurity, filesystem-flavored. New Drizzle tables in `packages/db`:

### `vault_files`
A row here means a **real, completed file** — uploads in progress live in `vault_uploads`
(below) and only graduate to `vault_files` on finalize. There is no `uploading` status.

```
id                   uuid pk        -- equals the vault_uploads.id it graduated from;
                                    -- also the immutable on-disk key
owner_user_id        uuid not null  fk users(id) cascade
directory_id         uuid null      fk vault_directories(id)   -- null = root
filename             text not null  -- basename only
size                 bigint not null check (size >= 0)
content_type         text not null
thumb_key            text null      -- set when a thumbnail exists
created_at           timestamp default now()   -- = finalize time
updated_at           timestamp default now()
deleted_at           timestamp null -- soft delete
original_directory_id uuid null     -- for restore-from-trash

unique (directory_id, filename, owner_user_id) where deleted_at is null
index (owner_user_id, created_at)
index (directory_id)
index (deleted_at)
-- pg_trgm GIN index on filename for fuzzy search
```

### `vault_uploads`
Dedicated upload-session table so resume, progress, and cleanup don't overload
`vault_files`. The row's `id` is allocated at upload start and **reused as the
`vault_files.id` and on-disk key** on finalize, so the bytes never move.

```
id              uuid pk
owner_user_id   uuid not null fk users(id) cascade
directory_id    uuid null      -- target directory for the finished file
filename        text not null
content_type    text not null
expected_size   bigint not null check (expected_size >= 0)
chunk_size      bigint not null
chunk_count     integer not null
uploaded_bytes  bigint not null default 0
received_chunks integer[] not null default '{}'  -- indices that have landed
created_at      timestamp default now()
last_chunk_at   timestamp null

index (owner_user_id)
index (last_chunk_at)   -- for the abandoned-upload reaper
```

### `vault_directories`
```
id                uuid pk
owner_user_id     uuid not null fk users(id) cascade
path              text not null  -- full path excluding userId, e.g. "notes/lorem"
name              text not null  -- basename
parent_id         uuid null fk vault_directories(id)
parent_path       text null
created_at        timestamp default now()
updated_at        timestamp default now()
deleted_at        timestamp null
original_parent_id uuid null
original_path      text null

unique (owner_user_id, path) where deleted_at is null
check (path <> '' and path !~ '/$')
index (owner_user_id)
index (parent_id)
index (parent_path)
index (deleted_at)
```

### `vault_item_metadata`
```
user_id     uuid not null fk users(id) cascade
file_id     uuid null fk vault_files(id) cascade
dir_id      uuid null fk vault_directories(id) cascade
starred_at  timestamp null
color       text null            -- predefined VaultColor enum
-- keyed by (user_id, file_id) or (user_id, dir_id); exactly one of file_id/dir_id set
```

**Logical folders are DB-only.** Renames and moves change rows only; the bytes on disk
never move (matches Futurity's immutable-key model).

## 3. Physical layout on tank

The mount path is read from `TANK_MOUNT_PATH` (env). The proxmox-claude reports the real
value; the app never hard-codes it. Under it:

```
<TANK_MOUNT_PATH>/cnet/users/<userId>/<fileId>             # file bytes, flat by id
<TANK_MOUNT_PATH>/cnet/users/<userId>/.thumbs/<fileId>.webp
<TANK_MOUNT_PATH>/cnet/users/<userId>/<fileId>.part        # in-progress chunked upload
```

`<fileId>` is the `vault_files.id`. Because the on-disk key is the immutable id, DB-only
moves/renames need no filesystem work.

## 4. Storage-adapter seam

`@cnet/engine` gains a `StorageAdapter` interface; controllers depend on the interface only.

```ts
interface StorageAdapter {
  // chunked upload (id = vault_uploads.id, later vault_files.id)
  appendChunk(userId: string, id: string, index: number, body: ReadableStream): Promise<void>
  finalize(userId: string, id: string): Promise<void>       // <id>.part -> <id>
  // lifecycle
  remove(userId: string, id: string): Promise<void>         // file or orphaned .part
  writeThumb(userId: string, id: string, body: Buffer): Promise<void>
  // delivery support
  resolvePath(userId: string, id: string): string           // for Caddy/range serving
  usage(userId: string): Promise<number>                    // sum of bytes (optional cross-check)
}
```

Received-chunk tracking is owned by the DB (`vault_uploads.received_chunks`), not the
adapter — one source of truth for resume.

`FilesystemAdapter` implements this over `<TANK_MOUNT_PATH>/cnet/users/...`. An in-memory
fake makes vault logic unit-testable. A future `S3Adapter`/`MinioAdapter` can slot in
without touching controllers.

## 5. Upload (chunked + resumable)

Upload sessions live in `vault_uploads`; the session `id` becomes the final `vault_files.id`.

1. `POST /vault/uploads` with metadata (`directoryId?`, `filename`, `contentType`,
   `expectedSize`, `chunkSize`) →
   - **Quota pre-flight (at start):** reject `413` if
     `SUM(vault_files.size for user) + SUM(vault_uploads.expected_size for user) + expectedSize > quota`.
     Checking at start (not just finalize) stops a user from filling the disk with `.part`
     bytes for an upload that can never fit. (The completed-files sum includes
     trashed-but-unpurged files, whose rows still exist — see §8.)
   - else create a `vault_uploads` row, return `{ uploadId, chunkSize, chunkCount }`.
2. `PUT /vault/uploads/:id/chunks/:index` streams a chunk → adapter appends to `<id>.part`;
   updates `uploaded_bytes`, appends `index` to `received_chunks`, sets `last_chunk_at`.
3. `GET /vault/uploads/:id` returns `received_chunks` (+ `uploaded_bytes`) so a dropped or
   refreshed client resumes without restarting.
4. `POST /vault/uploads/:id/finalize`:
   - verify every chunk index in `0..chunk_count-1` is present and `uploaded_bytes` matches
     the assembled file size; mismatch → `409`, keep the session for resume.
   - **Quota re-check** against actual size (guards against a wrong `expectedSize`).
   - adapter `finalize` (`<id>.part` → `<id>`), **insert** the `vault_files` row (resolving
     name collisions in the target dir per the rename policy), **delete** the `vault_uploads`
     row, enqueue the thumbnail job.

The frontend upload hook (ported from Futurity's `useUploadFileMutation`) swaps the
"presigned S3 PUT" step for these chunk endpoints; progress UI stays.

**Abandoned-upload reaper:** a scheduled BullMQ job deletes `vault_uploads` rows whose
`last_chunk_at` (or `created_at` if no chunk ever landed) is older than `VAULT_UPLOAD_TTL`
(default 24h) and calls `adapter.remove` on the orphaned `<id>.part`. This is the only thing
that frees a disappeared user's partial bytes.

## 6. Delivery (signed URLs via Caddy)

- `GET /vault/files/:id` returns a short-lived signed URL of the form
  `/dl/<userId>/<fileId>?sig=<hmac>&exp=<ts>&disp=<inline|attachment>`.
- Caddy `forward_auth`s `/dl/*` to an API endpoint that validates the HMAC signature,
  expiry, and ownership (or `super`). On `200`, Caddy serves the file from
  `<TANK_MOUNT_PATH>/cnet/users/<userId>/<fileId>` via `file_server` with **HTTP range
  support** (video scrubbing, resume) and copies `Content-Type` / `Content-Disposition`
  from the auth response headers. On `403`, Caddy denies.
- Bytes never pass through the Node process. The signing secret reuses the existing
  `AUTH_SECRET` family or a dedicated `VAULT_SIGNING_SECRET`.

The `Caddyfile` (`deploy/Caddyfile`) gains the `/dl/*` route; this is app-side work, not
part of the handover.

## 7. Thumbnails (worker)

On upload-finalize, a BullMQ job (using the existing `@cnet/workers` app) generates a
thumbnail into `.thumbs/<fileId>.webp`:
- images → `sharp`
- PDFs → first-page raster → `sharp`
- video → `ffmpeg` poster frame → `sharp`

On success, set `vault_files.thumb_key`. On failure, leave it null (UI shows a generic
icon); thumbnail failure never fails the upload. `ffmpeg` becomes a worker dependency.

## 8. Trash, star/color, search

- **Trash:** `DELETE /vault/files/:id` sets `deleted_at` (and `original_directory_id`).
  A Trash view lists soft-deleted items with restore / delete-forever. A scheduled BullMQ
  purge job removes rows past the retention window (default 30 days) and calls
  `adapter.remove` to free bytes. **Trashed files count against quota until purged.**
- **Restore collision policy:** restore targets `original_directory_id`. If a **live** file
  with the same `(directory_id, filename, owner_user_id)` already exists (the name was reused
  while this file sat in trash), the partial-unique index would reject the restore, so we
  **auto-rename** the restored file to `name (restored).ext`; if that also collides, append an
  incrementing counter — `name (restored 2).ext`, `name (restored 3).ext` — until it is unique.
  If `original_directory_id` no longer exists, restore to root with the same rename rule. This
  matches Futurity's "restore to original, rename on conflict" behavior. The same
  `name (N).ext` conflict resolver is reused for rename/move/finalize.
- **Star/color:** `vault_item_metadata`; "Starred" view and color filter. Pure organization.
- **Search:** filename `ILIKE` / `pg_trgm` fuzzy match, scoped to the current folder or
  global. No embeddings, no vectors.

## 9. Superuser admin (impersonation semantics)

The superuser override is isolated to a **dedicated admin controller**, never bolted onto the
shared vault endpoints. This is a security boundary, not a convenience:

- **The regular `VaultController` always derives `ownerUserId` from the authenticated session
  and never reads a user id from query/body/header.** There is no code path in the shared
  endpoints that lets a caller act on another user's files — eliminating the classic
  `req.query.userId` IDOR.
- A separate `AdminVaultController` (web: `/admin/vault/<userId>`, API: `/admin/vault/{userId}/*`)
  is the **only** place that targets a different user. Every handler there begins with the same
  guard, and it is the **single** authorized bypass in the codebase:
  ```ts
  if (user.role !== "super") throw new ForbiddenError()
  const ownerUserId = targetUserId   // from the path param, only here
  ```
- Implementation rule for the plan: a review/audit step greps every vault query path to assert
  the only `ownerUserId` that is not the session user appears inside `AdminVaultController`
  behind the `role === "super"` guard. Admin reads (browse/download/usage) and destructive
  actions (delete/purge) are both confined here.

## 10. proxmox-claude handover document

A separate `docs/HANDOVER-tank-storage-proxmox.md` is written for the Claude that runs on
the Proxmox host. It contains **only what cannot be done from inside this repo**, per the
owner's rule. Structure:

- **Goal + discovery (host-specific — must be discovered, cannot be prescribed):**
  - Bind-mount tank main into the C-Net LXC at a known path; **report back the resulting
    `TANK_MOUNT_PATH` and the method used.**
  - Discover the host layout before acting: `zpool list` / `zfs list` vs `lvs` / `vgs`,
    `pct config <id>` for the LXC, and whether the LXC is **privileged or unprivileged**
    (this determines whether `zfs` quota commands can run from inside vs must run on the host).
- **Exact prescribed commands (deterministic parts):**
  - Bind mount: `pct set <id> -mp0 <host-tank-path>/cnet,mp=<TANK_MOUNT_PATH>`
  - Per-user provisioning + 1 TB hard backstop (ZFS): `zfs create <pool>/cnet/users/<userId>`
    then `zfs set quota=1T <pool>/cnet/users/<userId>`
  - LVM fallback if the tank is LVM rather than ZFS (thin volume + mount), given concretely.
  - Contract: the app reads `TANK_MOUNT_PATH` and stores every user's files under
    `cnet/users/<userId>/`; the host must ensure that directory is writable by the LXC's
    mapped uid/gid.
- **Out of scope for the handover (app-side, done in-repo):** allowlist, role gating, Drizzle
  schema, upload/finalize endpoints, Caddy `/dl/*` config, thumbnail/purge workers, the Vault UI.

## Testing

- **Adapter:** unit-test `FilesystemAdapter` (chunk append, resume, finalize, remove) against
  a temp dir; in-memory fake for vault-logic tests.
- **Quota:** pre-flight rejection at start (completed + active uploads + new) and re-check at
  finalize; usage counts trashed-but-unpurged files.
- **Authz:** storage user blocked from non-vault routes and from other users' files; super
  reaches admin path; unlisted email rejected at sign-in. **Audit test:** the only non-session
  `ownerUserId` lives in `AdminVaultController` behind the `role === "super"` guard.
- **Upload resume:** drop mid-upload, query `received_chunks`, resume, finalize — bytes intact;
  finalize with a missing chunk → `409` and the session survives.
- **Abandoned-upload reaper:** a `vault_uploads` row past `VAULT_UPLOAD_TTL` and its `.part`
  are removed; an active session is left untouched.
- **Restore collision:** trash a file, reuse its name, restore → restored copy is auto-renamed
  `name (restored).ext` and the live file is unchanged.
- **Delivery:** signed URL validates; expired/forged signature denied; range requests serve
  partial content.
- **Build gate:** `bun run lint:check` and `bunx turbo build` (tsoa codegen + tsc) pass;
  migration files committed with the schema change.

## Open items deferred to the plan
- Default chunk size + client parallelism (client sends `chunkSize`; pick a sane default).
- Whether the signing secret is `AUTH_SECRET` or a dedicated `VAULT_SIGNING_SECRET`.
- Purge retention window default (30 days assumed) and `VAULT_UPLOAD_TTL` default (24h assumed).
- Caddy `forward_auth` header-passing specifics for `Content-Type`/`Content-Disposition`.
