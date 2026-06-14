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
| Uploads | **Chunked + resumable.** |
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
```
id                   uuid pk
owner_user_id        uuid not null  fk users(id) cascade
directory_id         uuid null      fk vault_directories(id)   -- null = root
filename             text not null  -- basename only
size                 bigint not null check (size >= 0)
content_type         text not null
status               enum('uploading','completed','failed') not null
thumb_key            text null      -- set when a thumbnail exists
created_at           timestamp default now()
updated_at           timestamp default now()
completed_at         timestamp null
deleted_at           timestamp null -- soft delete
original_directory_id uuid null     -- for restore-from-trash

unique (directory_id, filename, owner_user_id) where deleted_at is null
index (owner_user_id, created_at)
index (directory_id)
index (deleted_at)
index (status)
-- pg_trgm GIN index on filename for fuzzy search
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
  // chunked upload
  appendChunk(userId: string, fileId: string, index: number, body: ReadableStream): Promise<void>
  receivedChunks(userId: string, fileId: string): Promise<number[]>
  finalize(userId: string, fileId: string): Promise<void>   // .part -> final
  // lifecycle
  remove(userId: string, fileId: string): Promise<void>
  writeThumb(userId: string, fileId: string, body: Buffer): Promise<void>
  // delivery support
  resolvePath(userId: string, fileId: string): string       // for Caddy/range serving
  usage(userId: string): Promise<number>                    // sum of bytes (optional cross-check)
}
```

`FilesystemAdapter` implements this over `<TANK_MOUNT_PATH>/cnet/users/...`. An in-memory
fake makes vault logic unit-testable. A future `S3Adapter`/`MinioAdapter` can slot in
without touching controllers.

## 5. Upload (chunked + resumable)

1. `POST /vault/files` with metadata (`directoryId?`, `filename`, `contentType`, `size`)
   → creates a `vault_files` row with `status='uploading'`, returns `{ fileId }`.
2. `PUT /vault/files/:id/chunks/:index` streams a chunk → adapter appends to `<fileId>.part`.
3. `GET /vault/files/:id/chunks` returns received chunk indices so a dropped/refreshed
   client can resume without restarting.
4. `POST /vault/files/:id/finalize`:
   - **Quota pre-flight:** `usage = SUM(size) WHERE owner_user_id = user AND status = 'completed'`
     (this includes trashed-but-unpurged files, whose rows still exist — see §8) plus the
     still-pending file's size; if `usage > quota` → reject `413`, discard `.part`.
   - else: adapter `finalize` (`.part` → `<fileId>`), set `status='completed'`,
     `completed_at=now()`, enqueue the thumbnail job.

The frontend upload hook (ported from Futurity's `useUploadFileMutation`) swaps the
"presigned S3 PUT" step for these chunk endpoints; progress UI stays.

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
- **Star/color:** `vault_item_metadata`; "Starred" view and color filter. Pure organization.
- **Search:** filename `ILIKE` / `pg_trgm` fuzzy match, scoped to the current folder or
  global. No embeddings, no vectors.

## 9. Superuser admin

`super` gets `/admin/vault/<userId>` (web) and the corresponding API path that bypasses the
`ownerUserId === user.id` scope to browse, download, and delete any user's files and read
their usage. Storage users have no such path. This is enforced by the role check, not by a
separate table.

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
- **Quota:** pre-flight rejection at/over limit; usage counts trashed-but-unpurged files.
- **Authz:** storage user blocked from non-vault routes and from other users' files; super
  reaches admin path; unlisted email rejected at sign-in.
- **Upload resume:** drop mid-upload, query received chunks, resume, finalize — bytes intact.
- **Delivery:** signed URL validates; expired/forged signature denied; range requests serve
  partial content.
- **Build gate:** `bun run lint:check` and `bunx turbo build` (tsoa codegen + tsc) pass;
  migration files committed with the schema change.

## Open items deferred to the plan
- Exact chunk size / parallelism and the resume-handshake wire format.
- Whether the signing secret is `AUTH_SECRET` or a dedicated `VAULT_SIGNING_SECRET`.
- Purge retention window default (30 days assumed).
- Caddy `forward_auth` header-passing specifics for `Content-Type`/`Content-Disposition`.
