# Vault Plan 2 — Background Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the three background workers the Vault relies on: thumbnail generation (images/PDF/video), trash purge, and the abandoned-upload reaper.

**Architecture:** BullMQ workers in `@cnet/workers`, following the existing `createCleanupWorker` pattern. Thumbnails consume the `vault-thumbnails` queue (already enqueued by upload finalize); purge + reaper are repeatable jobs on a `vault-maintenance` queue, scheduled in `setupScheduledJobs`. Native tooling (sharp/ffmpeg/pdftoppm) degrades gracefully — missing tools just leave `thumbKey` null.

**Tech Stack:** BullMQ, Drizzle, `@cnet/engine` FilesystemAdapter, `sharp` (images), `ffmpeg` + `pdftoppm` via `node:child_process` (guarded).

**Spec:** `docs/superpowers/specs/2026-06-14-per-user-tank-storage-vault-design.md` §6–8.

**Gate per task:** `bunx biome check .` + per-package `bun run build` + `bun test` where added.

---

## Task 1: Queue names + getters (`@cnet/core`)

**File:** Modify `packages/core/src/queues.ts`.

- [ ] Add to `QUEUE_NAMES`: `VAULT_THUMBNAILS: "vault-thumbnails"`, `VAULT_MAINTENANCE: "vault-maintenance"`.
- [ ] Add getters `getVaultThumbnailsQueue()` and `getVaultMaintenanceQueue()` mirroring `getCleanupQueue`.
- [ ] Export both from `packages/core/src/index.ts`.
- [ ] Update `apps/api/src/controllers/vault-uploads.controller.ts` finalize to use `getVaultThumbnailsQueue()` instead of the `getQueue("vault-thumbnails")` literal.
- [ ] Gate + commit.

## Task 2: Thumbnail generation module (`@cnet/engine`)

**Files:** Create `packages/engine/src/vault/thumbnails.ts` + `thumbnails.test.ts`.

- [ ] `pickGenerator(contentType): "image" | "pdf" | "video" | null` — pure, unit-tested:
  - `image/*` → "image"; `application/pdf` → "pdf"; `video/*` → "video"; else null.
- [ ] `generateThumbnail(sourcePath: string, kind): Promise<Buffer | null>`:
  - image: `sharp(sourcePath).resize(256, 256, { fit: "inside" }).webp().toBuffer()`.
  - pdf: spawn `pdftoppm -png -singlefile -r 72 <sourcePath>` → pipe to sharp → webp; if `pdftoppm` missing, return null.
  - video: spawn `ffmpeg -i <sourcePath> -frames:v 1 -f image2pipe -vcodec png -` → sharp → webp; if `ffmpeg` missing, return null.
  - wrap all in try/catch → null on any failure.
- [ ] Add `sharp` to `packages/engine/package.json` deps; `bun install`.
- [ ] Unit-test `pickGenerator` only (no native tooling in tests).
- [ ] Export from engine index. Gate + commit.

## Task 3: Thumbnail worker (`@cnet/workers`)

**File:** Create `apps/workers/src/workers/vault-thumbnails.ts`.

- [ ] `createVaultThumbnailsWorker()` on `QUEUE_NAMES.VAULT_THUMBNAILS`, job data `{ userId, fileId, contentType }`:
  - `pickGenerator`; if null, return `{ skipped: true }`.
  - load the file row (must exist, not deleted); resolve source path via `getStorageAdapter().resolvePath`.
  - `generateThumbnail`; if null, return `{ skipped: true }`.
  - `getStorageAdapter().writeThumb(userId, fileId, buf)`; `update vaultFiles set thumbKey = '<fileId>.webp'`.
  - errors logged, not re-thrown beyond BullMQ's retry.
- [ ] Register in `apps/workers/src/index.ts` `initializeWorkers`. Gate + commit.

## Task 4: Maintenance worker — purge + reaper (`@cnet/workers`)

**File:** Create `apps/workers/src/workers/vault-maintenance.ts`.

- [ ] `cutoffDate(now, msAgo)` pure helper + a tiny unit test.
- [ ] `createVaultMaintenanceWorker()` on `QUEUE_NAMES.VAULT_MAINTENANCE`, job data `{ type: "purge-trash" | "reap-uploads" }`:
  - **purge-trash:** `VAULT_TRASH_TTL_DAYS` (default 30). Select `vaultFiles` where `deletedAt < cutoff`; for each `adapter.remove(ownerUserId, id)` then delete row. Delete `vaultDirectories` where `deletedAt < cutoff` (no bytes).
  - **reap-uploads:** `VAULT_UPLOAD_TTL_HOURS` (default 24). Select `vaultUploads` where `coalesce(lastChunkAt, createdAt) < cutoff`; for each `adapter.remove(ownerUserId, id)` (clears the `.part`) then delete row.
- [ ] Schedule both in `setupScheduledJobs`: purge daily (`0 3 * * *`), reap hourly (`every: 3600*1000`), with stable `jobId`s.
- [ ] Register the worker in `initializeWorkers`. Gate + commit + push.

## Self-review
- §6 thumbnails (T2/T3), §8 purge (T4), §5 reaper (T4). Queue contract from Plan 1 finalize (T1).
- Native-tool absence must degrade to skipped, never crash the worker.
