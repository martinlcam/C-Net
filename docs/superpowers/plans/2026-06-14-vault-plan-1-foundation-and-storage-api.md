# Vault Plan 1 — Foundation & Storage API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn C-Net into a light multi-user app (super/storage roles via an allowlist) and build the filesystem-backed Vault **API** on tank main — directories, chunked/resumable uploads, signed-URL delivery, trash, star/color, search, plus an isolated superuser admin path. No frontend in this plan.

**Architecture:** Roles resolve from an env/config allowlist by email at request time (no new `users` columns). A `StorageAdapter` seam in `@cnet/engine` (one `FilesystemAdapter`) keeps `fs` out of controllers. Four new Drizzle tables (`vault_files`, `vault_directories`, `vault_uploads`, `vault_item_metadata`). tsoa controllers follow the existing `@Route/@Security("jwt")` pattern; the only cross-user bypass lives in a dedicated `AdminVaultController` guarded by `role === "super"`. Delivery uses HMAC-signed, short-lived URLs served with HTTP range support (Caddy direct-serve from disk in prod as an additive optimization over the same contract).

**Tech Stack:** Bun, Turborepo, Express 5 + tsoa, Drizzle ORM (Postgres), `node:fs`/`node:crypto`, Biome. Tests: `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-14-per-user-tank-storage-vault-design.md`

**Verification gate (every task ends here):**
- `bunx biome check .` (lint/format) — fix findings in touched files.
- `bunx turbo build` (tsoa spec-and-routes + tsc across the graph) — the type-check gate.
- `bun test` for tasks that add unit tests.
- Migrations: after schema tasks, `bun run db:generate` then **commit** the generated SQL + `meta/_journal.json` in the same commit as the schema edit.

**Branch:** all work on `feat/vault-storage` off `main`. Commits use the `[agent]` prefix and the `Co-Authored-By` footer per CLAUDE.md.

---

## File structure (created/modified in this plan)

**`@cnet/core`**
- Create `packages/core/src/access/allowlist.ts` — allowlist parsing, role + quota resolution, size parsing.
- Create `packages/core/src/access/allowlist.test.ts` — unit tests.
- Create `packages/core/src/vault/signing.ts` — HMAC sign/verify for download URLs.
- Create `packages/core/src/vault/signing.test.ts` — unit tests.
- Create `packages/core/src/vault/naming.ts` — `name (N).ext` / `name (restored).ext` collision resolver.
- Create `packages/core/src/vault/naming.test.ts` — unit tests.
- Modify `packages/core/src/authorization.ts` — reimplement `isEmailAuthorized` over the allowlist.
- Modify `packages/core/src/index.ts` — export the new modules.
- Modify `packages/core/package.json` — add a `test` script.

**`@cnet/db`**
- Create `packages/db/src/schema/vault-files.ts`
- Create `packages/db/src/schema/vault-directories.ts`
- Create `packages/db/src/schema/vault-uploads.ts`
- Create `packages/db/src/schema/vault-item-metadata.ts`
- Modify `packages/db/src/schema/index.ts` — export the new tables.
- Modify `packages/db/src/schema/relations.ts` — add vault relations.
- Generated: `packages/db/migrations/**` (committed).

**`@cnet/engine`**
- Create `packages/engine/src/vault/adapter.ts` — `StorageAdapter` interface.
- Create `packages/engine/src/vault/filesystem-adapter.ts` — `FilesystemAdapter`.
- Create `packages/engine/src/vault/filesystem-adapter.test.ts` — unit tests.
- Modify `packages/engine/src/index.ts` — export the vault module.

**`@cnet/api`**
- Create `apps/api/src/vault/access.ts` — request→role/quota/owner helpers + `ForbiddenError`.
- Create `apps/api/src/vault/usage.ts` — quota usage queries.
- Create `apps/api/src/controllers/vault-directories.controller.ts`
- Create `apps/api/src/controllers/vault-files.controller.ts`
- Create `apps/api/src/controllers/vault-uploads.controller.ts`
- Create `apps/api/src/controllers/vault-download.controller.ts`
- Create `apps/api/src/controllers/admin-vault.controller.ts`
- Modify `apps/api/src/middleware/auth.middleware.ts` — surface `email` on `req.user` (already returned by `verifyToken`).

**`@cnet/web`** (foundation only; UI is Plan 3)
- Modify `apps/web/lib/auth.config.ts` — allowlist gate + `role` in jwt/session callbacks.
- Create `apps/web/middleware.ts` — redirect `storage` users to `/vault` away from other routes (route guard only; the page itself is Plan 3).

**Deploy / docs**
- Modify `deploy/Caddyfile` — `/dl/*` direct-serve block (prod optimization).
- Create `docs/HANDOVER-tank-storage-proxmox.md` — the proxmox-claude handover.
- Modify `.env.example` (if present) / document new env vars.

**New env vars:** `VAULT_ALLOWLIST` (JSON), `TANK_MOUNT_PATH` (filesystem root), `VAULT_SIGNING_SECRET` (falls back to `AUTH_SECRET`), `VAULT_UPLOAD_TTL_HOURS` (default 24), `VAULT_TRASH_TTL_DAYS` (default 30; consumed in Plan 2).

---

## Task 1: Allowlist & role/quota resolution (`@cnet/core`)

**Files:**
- Create: `packages/core/src/access/allowlist.ts`
- Test: `packages/core/src/access/allowlist.test.ts`
- Modify: `packages/core/package.json` (add `"test": "bun test"`)

- [ ] **Step 1: Add the test script** to `packages/core/package.json` scripts: `"test": "bun test"`.

- [ ] **Step 2: Write the failing tests** (`allowlist.test.ts`):

```ts
import { describe, expect, it } from "bun:test"
import {
  getAllowlistEntry,
  isEmailAuthorized,
  parseAllowlist,
  parseSize,
} from "./allowlist"

const RAW = JSON.stringify([
  { email: "super@x.com", role: "super" },
  { email: "alice@x.com", role: "storage", quota: "1T" },
  { email: "bob@x.com", role: "storage", quota: "500G" },
])

describe("parseSize", () => {
  it("parses binary units", () => {
    expect(parseSize("1T")).toBe(1024 ** 4)
    expect(parseSize("500G")).toBe(500 * 1024 ** 3)
    expect(parseSize("250M")).toBe(250 * 1024 ** 2)
    expect(parseSize("1024")).toBe(1024)
  })
  it("throws on garbage", () => {
    expect(() => parseSize("banana")).toThrow()
  })
})

describe("parseAllowlist", () => {
  it("parses entries and quota to bytes", () => {
    const list = parseAllowlist(RAW)
    expect(list).toHaveLength(3)
    expect(list[0]).toEqual({ email: "super@x.com", role: "super", quotaBytes: null })
    expect(list[1].quotaBytes).toBe(1024 ** 4)
  })
  it("is case-insensitive on email and falls back to a super default when unset", () => {
    const list = parseAllowlist(undefined)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].role).toBe("super")
  })
})

describe("getAllowlistEntry / isEmailAuthorized", () => {
  const list = parseAllowlist(RAW)
  it("matches case-insensitively", () => {
    expect(getAllowlistEntry("ALICE@x.com", list)?.role).toBe("storage")
    expect(isEmailAuthorized("bob@x.com", list)).toBe(true)
  })
  it("rejects unlisted emails", () => {
    expect(getAllowlistEntry("eve@x.com", list)).toBeNull()
    expect(isEmailAuthorized("eve@x.com", list)).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests, verify they fail**

Run: `cd packages/core && bun test src/access/allowlist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** `allowlist.ts`:

```ts
export type VaultRole = "super" | "storage"

export type AllowlistEntry = {
  email: string
  role: VaultRole
  quotaBytes: number | null // null = unlimited
}

const UNIT_MULTIPLIER: Record<string, number> = {
  K: 1024,
  M: 1024 ** 2,
  G: 1024 ** 3,
  T: 1024 ** 4,
}

/** Parse a binary size like "1T", "500G", "250M", or a plain byte count. */
export function parseSize(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGT])?B?$/i.exec(input.trim())
  if (!match) throw new Error(`Invalid size: ${input}`)
  const value = Number.parseFloat(match[1])
  const unit = match[2]?.toUpperCase()
  return Math.round(value * (unit ? UNIT_MULTIPLIER[unit] : 1))
}

/** Default allowlist preserves pre-existing single-owner behavior. */
const DEFAULT_SUPER_EMAIL = "martinlucam@gmail.com"

type RawEntry = { email: string; role: VaultRole; quota?: string | null }

export function parseAllowlist(raw: string | undefined): AllowlistEntry[] {
  const source = raw?.trim()
  if (!source) {
    return [{ email: DEFAULT_SUPER_EMAIL.toLowerCase(), role: "super", quotaBytes: null }]
  }
  const parsed = JSON.parse(source) as RawEntry[]
  return parsed.map((e) => ({
    email: e.email.trim().toLowerCase(),
    role: e.role,
    quotaBytes: e.quota ? parseSize(e.quota) : null,
  }))
}

/** Lazily parse from VAULT_ALLOWLIST unless an explicit list is passed (tests). */
export function currentAllowlist(list?: AllowlistEntry[]): AllowlistEntry[] {
  return list ?? parseAllowlist(process.env.VAULT_ALLOWLIST)
}

export function getAllowlistEntry(
  email: string,
  list?: AllowlistEntry[]
): AllowlistEntry | null {
  const needle = email.trim().toLowerCase()
  return currentAllowlist(list).find((e) => e.email === needle) ?? null
}

export function isEmailAuthorized(email: string, list?: AllowlistEntry[]): boolean {
  return getAllowlistEntry(email, list) !== null
}
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `cd packages/core && bun test src/access/allowlist.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Rewire `authorization.ts`** to delegate (keep the export surface):

```ts
import { isEmailAuthorized as check } from "./access/allowlist"

export function isEmailAuthorized(email: string): boolean {
  return check(email)
}
```

- [ ] **Step 7: Export from `@cnet/core`** — add to `packages/core/src/index.ts`:

```ts
export {
  type AllowlistEntry,
  type VaultRole,
  getAllowlistEntry,
  isEmailAuthorized,
  parseAllowlist,
  parseSize,
} from "./access/allowlist"
```
(Remove the old `export { isEmailAuthorized } from "./authorization"` line to avoid a duplicate export; `authorization.ts` stays for any direct importers.)

- [ ] **Step 8: Gate + commit**

```bash
cd ../../ && bunx biome check packages/core && bunx turbo build --filter=@cnet/core
git add packages/core && git commit -m "[agent] feat(core): allowlist-based roles and quota resolution

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: URL signing (`@cnet/core`)

**Files:**
- Create: `packages/core/src/vault/signing.ts`
- Test: `packages/core/src/vault/signing.test.ts`

- [ ] **Step 1: Write the failing tests** (`signing.test.ts`):

```ts
import { describe, expect, it } from "bun:test"
import { signDownload, verifyDownload } from "./signing"

const SECRET = "test-secret"

describe("signDownload / verifyDownload", () => {
  it("round-trips a valid token", () => {
    const exp = 10_000
    const sig = signDownload({ userId: "u1", fileId: "f1", exp, disposition: "inline" }, SECRET)
    const res = verifyDownload(
      { userId: "u1", fileId: "f1", exp, disposition: "inline", sig },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(true)
  })
  it("rejects an expired token", () => {
    const sig = signDownload({ userId: "u1", fileId: "f1", exp: 1_000, disposition: "inline" }, SECRET)
    const res = verifyDownload(
      { userId: "u1", fileId: "f1", exp: 1_000, disposition: "inline", sig },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(false)
  })
  it("rejects a forged signature", () => {
    const res = verifyDownload(
      { userId: "u1", fileId: "f1", exp: 10_000, disposition: "inline", sig: "deadbeef" },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(false)
  })
  it("rejects a tampered field", () => {
    const sig = signDownload({ userId: "u1", fileId: "f1", exp: 10_000, disposition: "inline" }, SECRET)
    const res = verifyDownload(
      { userId: "u1", fileId: "OTHER", exp: 10_000, disposition: "inline", sig },
      SECRET,
      5_000
    )
    expect(res.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail.** `cd packages/core && bun test src/vault/signing.test.ts` → FAIL.

- [ ] **Step 3: Implement** `signing.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto"

export type Disposition = "inline" | "attachment"

export type DownloadClaims = {
  userId: string
  fileId: string
  exp: number // epoch ms
  disposition: Disposition
}

function canonical(c: DownloadClaims): string {
  return `${c.userId}.${c.fileId}.${c.exp}.${c.disposition}`
}

export function signDownload(claims: DownloadClaims, secret: string): string {
  return createHmac("sha256", secret).update(canonical(claims)).digest("hex")
}

export function verifyDownload(
  input: DownloadClaims & { sig: string },
  secret: string,
  nowMs: number
): { ok: boolean } {
  const expected = signDownload(input, secret)
  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(input.sig, "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false }
  if (input.exp < nowMs) return { ok: false }
  return { ok: true }
}

export function vaultSigningSecret(): string {
  const secret = process.env.VAULT_SIGNING_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("VAULT_SIGNING_SECRET or AUTH_SECRET must be set")
  return secret
}
```

- [ ] **Step 4: Run, verify pass.** `bun test src/vault/signing.test.ts` → PASS.

- [ ] **Step 5: Export** from `packages/core/src/index.ts`:

```ts
export {
  type Disposition,
  type DownloadClaims,
  signDownload,
  vaultSigningSecret,
  verifyDownload,
} from "./vault/signing"
```

- [ ] **Step 6: Gate + commit**

```bash
cd ../../ && bunx biome check packages/core && bunx turbo build --filter=@cnet/core
git add packages/core && git commit -m "[agent] feat(core): HMAC signing for vault download URLs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Filename collision resolver (`@cnet/core`)

**Files:**
- Create: `packages/core/src/vault/naming.ts`
- Test: `packages/core/src/vault/naming.test.ts`

- [ ] **Step 1: Write the failing tests** (`naming.test.ts`):

```ts
import { describe, expect, it } from "bun:test"
import { resolveCollision } from "./naming"

describe("resolveCollision", () => {
  const taken = new Set(["file.txt", "file (1).txt", "report.pdf"])
  it("returns the name unchanged when free", () => {
    expect(resolveCollision("fresh.txt", taken)).toBe("fresh.txt")
  })
  it("appends an incrementing counter, skipping taken names", () => {
    expect(resolveCollision("file.txt", taken)).toBe("file (2).txt")
  })
  it("handles names without an extension", () => {
    expect(resolveCollision("report.pdf", taken)).toBe("report (1).pdf")
    expect(resolveCollision("README", new Set(["README"]))).toBe("README (1)")
  })
  it("uses a custom suffix for restores", () => {
    const t = new Set(["a.txt"])
    expect(resolveCollision("a.txt", t, "restored")).toBe("a (restored).txt")
    t.add("a (restored).txt")
    expect(resolveCollision("a.txt", t, "restored")).toBe("a (restored 2).txt")
  })
})
```

- [ ] **Step 2: Run, verify fail.** → FAIL.

- [ ] **Step 3: Implement** `naming.ts`:

```ts
/** Split "a.tar.gz" into ["a", ".tar.gz"]? No — only the last extension: ["a.tar", ".gz"]. */
function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return [name, ""]
  return [name.slice(0, dot), name.slice(dot)]
}

/**
 * Return a name not present in `taken`.
 * Default policy: "name (1).ext", "name (2).ext", ...
 * With `label` (e.g. "restored"): "name (restored).ext", "name (restored 2).ext", ...
 */
export function resolveCollision(name: string, taken: Set<string>, label?: string): string {
  if (!taken.has(name)) return name
  const [base, ext] = splitExt(name)
  if (label) {
    let candidate = `${base} (${label})${ext}`
    let n = 2
    while (taken.has(candidate)) candidate = `${base} (${label} ${n++})${ext}`
    return candidate
  }
  let n = 1
  let candidate = `${base} (${n})${ext}`
  while (taken.has(candidate)) candidate = `${base} (${++n})${ext}`
  return candidate
}
```

- [ ] **Step 4: Run, verify pass.** → PASS.

- [ ] **Step 5: Export** from `packages/core/src/index.ts`:

```ts
export { resolveCollision } from "./vault/naming"
```

- [ ] **Step 6: Gate + commit**

```bash
bunx biome check packages/core && bunx turbo build --filter=@cnet/core
git add packages/core && git commit -m "[agent] feat(core): filename collision resolver for vault

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Vault DB schema + migration (`@cnet/db`)

**Files:**
- Create: `packages/db/src/schema/vault-directories.ts`, `vault-files.ts`, `vault-uploads.ts`, `vault-item-metadata.ts`
- Modify: `packages/db/src/schema/index.ts`, `relations.ts`
- Generated: `packages/db/migrations/**`

- [ ] **Step 1: `vault-directories.ts`** (create before files — files FK it):

```ts
import { sql } from "drizzle-orm"
import { type AnyPgColumn, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const vaultDirectories = pgTable(
  "vault_directories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    path: text("path").notNull(), // excludes userId, e.g. "notes/lorem"
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => vaultDirectories.id, {
      onDelete: "cascade",
    }),
    parentPath: text("parent_path"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    originalParentId: uuid("original_parent_id"),
    originalPath: text("original_path"),
  },
  (t) => ({
    uniqueLivePath: unique("vault_dir_owner_path_uniq").on(t.ownerUserId, t.path).nullsNotDistinct(),
    ownerIdx: index("vault_dir_owner_idx").on(t.ownerUserId),
    parentIdx: index("vault_dir_parent_idx").on(t.parentId),
    parentPathIdx: index("vault_dir_parent_path_idx").on(t.parentPath),
    deletedIdx: index("vault_dir_deleted_idx").on(t.deletedAt),
  })
)
```
> Note: a true partial-unique-where-`deleted_at IS NULL` index is added as raw SQL in the migration (Step 5), since drizzle-kit's `unique()` can't express a `WHERE`. The `unique()` above is replaced there.

- [ ] **Step 2: `vault-files.ts`**:

```ts
import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { vaultDirectories } from "./vault-directories"
import { users } from "./users"

export const vaultFiles = pgTable(
  "vault_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    directoryId: uuid("directory_id").references(() => vaultDirectories.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    thumbKey: text("thumb_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    originalDirectoryId: uuid("original_directory_id"),
  },
  (t) => ({
    ownerCreatedIdx: index("vault_file_owner_created_idx").on(t.ownerUserId, t.createdAt),
    directoryIdx: index("vault_file_directory_idx").on(t.directoryId),
    deletedIdx: index("vault_file_deleted_idx").on(t.deletedAt),
  })
)
```

- [ ] **Step 3: `vault-uploads.ts`**:

```ts
import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const vaultUploads = pgTable(
  "vault_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    directoryId: uuid("directory_id"),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    expectedSize: bigint("expected_size", { mode: "number" }).notNull(),
    chunkSize: bigint("chunk_size", { mode: "number" }).notNull(),
    chunkCount: integer("chunk_count").notNull(),
    uploadedBytes: bigint("uploaded_bytes", { mode: "number" }).notNull().default(0),
    receivedChunks: integer("received_chunks").array().notNull().default(sql`'{}'`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastChunkAt: timestamp("last_chunk_at"),
  },
  (t) => ({
    ownerIdx: index("vault_upload_owner_idx").on(t.ownerUserId),
    lastChunkIdx: index("vault_upload_last_chunk_idx").on(t.lastChunkAt),
  })
)
```
> Add `import { sql } from "drizzle-orm"` at the top.

- [ ] **Step 4: `vault-item-metadata.ts`**:

```ts
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { vaultDirectories } from "./vault-directories"
import { vaultFiles } from "./vault-files"
import { users } from "./users"

// One row per (user, item). Exactly one of fileId/dirId is set.
export const vaultItemMetadata = pgTable(
  "vault_item_metadata",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => vaultFiles.id, { onDelete: "cascade" }),
    dirId: uuid("dir_id").references(() => vaultDirectories.id, { onDelete: "cascade" }),
    starredAt: timestamp("starred_at"),
    color: text("color"),
  },
  (t) => ({
    fileMetaIdx: index("vault_meta_file_idx").on(t.userId, t.fileId),
    dirMetaIdx: index("vault_meta_dir_idx").on(t.userId, t.dirId),
  })
)
```

- [ ] **Step 5: Wire schema exports + relations.**
  - `schema/index.ts`: add `export * from "./vault-directories"`, `./vault-files`, `./vault-uploads`, `./vault-item-metadata`.
  - `schema/relations.ts`: extend `usersRelations` with `vaultFiles: many(vaultFiles)`, `vaultDirectories: many(vaultDirectories)`, `vaultUploads: many(vaultUploads)`, and add `vaultFilesRelations`/`vaultDirectoriesRelations` mapping `ownerUserId → users.id` (follow the existing `serviceCredentialsRelations` shape).

- [ ] **Step 6: Generate the migration.**

Run: `bun run db:generate`
Expected: a new file under `packages/db/migrations/` + updated `meta/_journal.json`.

- [ ] **Step 7: Add the partial-unique indexes** the generator can't express. Append to the generated `.sql` (and keep it idempotent):

```sql
DROP INDEX IF EXISTS "vault_dir_owner_path_uniq";
CREATE UNIQUE INDEX "vault_dir_owner_path_live"
  ON "vault_directories" ("owner_user_id", "path") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "vault_file_dir_name_owner_live"
  ON "vault_files" ("directory_id", "filename", "owner_user_id") WHERE "deleted_at" IS NULL;
-- root-level files have NULL directory_id; enforce uniqueness there too:
CREATE UNIQUE INDEX "vault_file_root_name_owner_live"
  ON "vault_files" ("filename", "owner_user_id")
  WHERE "deleted_at" IS NULL AND "directory_id" IS NULL;
-- pg_trgm fuzzy filename search:
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "vault_file_filename_trgm" ON "vault_files" USING gin ("filename" gin_trgm_ops);
```

- [ ] **Step 8: Apply + gate + commit.**

```bash
bun run db:start && bun run db:migrate
bunx biome check packages/db && bunx turbo build --filter=@cnet/db
git add packages/db && git commit -m "[agent] feat(db): vault files/directories/uploads/metadata schema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Storage adapter (`@cnet/engine`)

**Files:**
- Create: `packages/engine/src/vault/adapter.ts`, `filesystem-adapter.ts`
- Test: `packages/engine/src/vault/filesystem-adapter.test.ts`
- Modify: `packages/engine/src/index.ts`; add `"test": "bun test"` to `packages/engine/package.json`.

- [ ] **Step 1: `adapter.ts`** — the interface:

```ts
import type { Readable } from "node:stream"

export interface StorageAdapter {
  // chunked upload (id = vault_uploads.id, later vault_files.id)
  appendChunk(userId: string, id: string, index: number, body: Buffer): Promise<void>
  finalize(userId: string, id: string): Promise<void> // <id>.part -> <id>
  remove(userId: string, id: string): Promise<void> // file or orphaned .part
  writeThumb(userId: string, id: string, body: Buffer): Promise<void>
  // delivery
  resolvePath(userId: string, id: string): string
  createReadStream(userId: string, id: string, range?: { start: number; end: number }): Readable
  size(userId: string, id: string): Promise<number>
}
```

- [ ] **Step 2: Write the failing tests** (`filesystem-adapter.test.ts`) — exercise append→finalize→read→remove against a temp dir:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { FilesystemAdapter } from "./filesystem-adapter"

let root: string
let adapter: FilesystemAdapter

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "vault-"))
  adapter = new FilesystemAdapter(root)
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("FilesystemAdapter", () => {
  it("appends chunks, finalizes, reads back", async () => {
    await adapter.appendChunk("u1", "f1", 0, Buffer.from("hello "))
    await adapter.appendChunk("u1", "f1", 1, Buffer.from("world"))
    await adapter.finalize("u1", "f1")
    expect(await adapter.size("u1", "f1")).toBe(11)
    const bytes = await readFile(adapter.resolvePath("u1", "f1"))
    expect(bytes.toString()).toBe("hello world")
  })
  it("serves a byte range", async () => {
    const chunks: Buffer[] = []
    const stream = adapter.createReadStream("u1", "f1", { start: 0, end: 4 })
    for await (const c of stream) chunks.push(c as Buffer)
    expect(Buffer.concat(chunks).toString()).toBe("hello")
  })
  it("removes a file", async () => {
    await adapter.remove("u1", "f1")
    await expect(adapter.size("u1", "f1")).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Run, verify fail.** → FAIL.

- [ ] **Step 4: Implement** `filesystem-adapter.ts`:

```ts
import { createReadStream, type ReadStream } from "node:fs"
import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { StorageAdapter } from "./adapter"

export class FilesystemAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private userDir(userId: string): string {
    return join(this.root, "cnet", "users", userId)
  }
  private filePath(userId: string, id: string): string {
    return join(this.userDir(userId), id)
  }
  private partPath(userId: string, id: string): string {
    return `${this.filePath(userId, id)}.part`
  }
  private thumbPath(userId: string, id: string): string {
    return join(this.userDir(userId), ".thumbs", `${id}.webp`)
  }

  async appendChunk(userId: string, id: string, _index: number, body: Buffer): Promise<void> {
    const p = this.partPath(userId, id)
    await mkdir(dirname(p), { recursive: true })
    await appendFile(p, body)
  }
  async finalize(userId: string, id: string): Promise<void> {
    await rename(this.partPath(userId, id), this.filePath(userId, id))
  }
  async remove(userId: string, id: string): Promise<void> {
    await rm(this.filePath(userId, id), { force: true })
    await rm(this.partPath(userId, id), { force: true })
    await rm(this.thumbPath(userId, id), { force: true })
  }
  async writeThumb(userId: string, id: string, body: Buffer): Promise<void> {
    const p = this.thumbPath(userId, id)
    await mkdir(dirname(p), { recursive: true })
    await appendFile(p, body) // file is created fresh by callers after remove; or use writeFile
  }
  resolvePath(userId: string, id: string): string {
    return this.filePath(userId, id)
  }
  createReadStream(userId: string, id: string, range?: { start: number; end: number }): ReadStream {
    return createReadStream(this.filePath(userId, id), range)
  }
  async size(userId: string, id: string): Promise<number> {
    const s = await stat(this.filePath(userId, id))
    return s.size
  }
}

let singleton: FilesystemAdapter | null = null
export function getStorageAdapter(): FilesystemAdapter {
  if (!singleton) {
    const root = process.env.TANK_MOUNT_PATH
    if (!root) throw new Error("TANK_MOUNT_PATH is not set")
    singleton = new FilesystemAdapter(root)
  }
  return singleton
}
```
> Fix `writeThumb` to use `writeFile` (overwrite) rather than `appendFile`; import `writeFile` from `node:fs/promises`.

- [ ] **Step 5: Run, verify pass.** → PASS.

- [ ] **Step 6: Export** from `packages/engine/src/index.ts`:

```ts
export { FilesystemAdapter, getStorageAdapter } from "./vault/filesystem-adapter"
export type { StorageAdapter } from "./vault/adapter"
```

- [ ] **Step 7: Gate + commit**

```bash
bunx biome check packages/engine && bunx turbo build --filter=@cnet/engine
git add packages/engine && git commit -m "[agent] feat(engine): filesystem storage adapter for vault

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: API access helpers (`@cnet/api`)

**Files:**
- Create: `apps/api/src/vault/access.ts`, `apps/api/src/vault/usage.ts`
- Modify: `apps/api/src/middleware/auth.middleware.ts` (no code change needed — `verifyToken` already returns `email`; just confirm `req.user` typing includes `email`).

- [ ] **Step 1: `access.ts`** — resolve role/quota/owner and a `ForbiddenError`:

```ts
import { getAllowlistEntry, type VaultRole } from "@cnet/core"
import type { Request as ExpressRequest } from "express"

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export type VaultActor = { id: string; email: string; role: VaultRole; quotaBytes: number | null }

export function actorFrom(req: ExpressRequest): VaultActor {
  const user = req.user as { id: string; email: string }
  const entry = getAllowlistEntry(user.email)
  if (!entry) throw new ForbiddenError("Not authorized for vault")
  return { id: user.id, email: user.email, role: entry.role, quotaBytes: entry.quotaBytes }
}

export function requireSuper(actor: VaultActor): void {
  if (actor.role !== "super") throw new ForbiddenError("Superuser only")
}
```

- [ ] **Step 2: Map `ForbiddenError` → 403** in `apps/api/src/middleware/error.middleware.ts`. Add, before the generic `Error` branch:

```ts
  if (err instanceof Error && err.name === "ForbiddenError") {
    res.status(403).json({ message: err.message })
    return
  }
```

- [ ] **Step 3: `usage.ts`** — quota accounting:

```ts
import { db } from "@cnet/db"
import { vaultFiles, vaultUploads } from "@cnet/db/schema"
import { and, eq, sql } from "drizzle-orm"

/** Bytes of completed files (includes trashed-but-unpurged: those rows still exist). */
export async function completedUsage(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${vaultFiles.size}), 0)` })
    .from(vaultFiles)
    .where(eq(vaultFiles.ownerUserId, userId))
  return Number(row?.total ?? 0)
}

/** Bytes reserved by in-flight uploads (expected sizes). */
export async function pendingUsage(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${vaultUploads.expectedSize}), 0)` })
    .from(vaultUploads)
    .where(eq(vaultUploads.ownerUserId, userId))
  return Number(row?.total ?? 0)
}

export async function wouldExceedQuota(
  userId: string,
  quotaBytes: number | null,
  addBytes: number
): Promise<boolean> {
  if (quotaBytes === null) return false
  const used = (await completedUsage(userId)) + (await pendingUsage(userId))
  return used + addBytes > quotaBytes
}
```

- [ ] **Step 4: Gate + commit**

```bash
bunx biome check apps/api && bunx turbo build --filter=@cnet/api
git add apps/api && git commit -m "[agent] feat(api): vault access helpers and quota accounting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Directories controller (`@cnet/api`)

**File:** Create `apps/api/src/controllers/vault-directories.controller.ts`. Follows the `infrastructure.controller.ts` pattern (`@Route`, `@Security("jwt")`, `req.user`, `this.setStatus`). All queries scope to `actorFrom(req).id`.

Endpoints:
- `GET /vault/directories?directoryId=` → `{ directory, breadcrumbs, directories, files }`. `directory` is null at root. `files` include `downloadUrl`/`previewUrl` via the signing util (Task 9 helper `signedUrlsFor(actor.id, file)`); import that helper.
- `POST /vault/directories` `{ parentId?, name }` → create; compute `path` from parent; resolve name collision among sibling live dirs with `resolveCollision`.
- `POST /vault/directories/:id/rename` `{ name }` → rename within parent; collision-resolved.
- `POST /vault/directories/:id/move` `{ parentId }` → reparent; recompute `path`/`parentPath` for the subtree (update descendants by `parentPath` prefix).
- `DELETE /vault/directories/:id` → soft-delete (set `deletedAt`, `originalParentId`, `originalPath`) and cascade-soft-delete descendants + their files.

- [ ] **Step 1:** Implement the controller per the above, scoping every query with `eq(vaultDirectories.ownerUserId, actor.id)` and `isNull(deletedAt)` for live reads.
- [ ] **Step 2:** `bunx turbo build --filter=@cnet/api` — confirm tsoa regenerates routes and types pass.
- [ ] **Step 3:** Manual smoke: `bun run dev:api`, then `curl` create/list/rename/move/delete with a valid session cookie; confirm shapes.
- [ ] **Step 4: Gate + commit**

```bash
bunx biome check apps/api && bunx turbo build --filter=@cnet/api
git add apps/api && git commit -m "[agent] feat(api): vault directories controller

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Uploads controller (`@cnet/api`)

**File:** Create `apps/api/src/controllers/vault-uploads.controller.ts`.

Endpoints (all scoped to `actorFrom(req).id`):
- `POST /vault/uploads` `{ directoryId?, filename, contentType, expectedSize, chunkSize }` →
  - `wouldExceedQuota(actor.id, actor.quotaBytes, expectedSize)` → `413` if over.
  - insert `vault_uploads` (compute `chunkCount = ceil(expectedSize / chunkSize)`), return `{ uploadId, chunkSize, chunkCount }`.
- `PUT /vault/uploads/:id/chunks/:index` — raw body (configure an `express.raw` body for this route in `server.ts`, capped at `chunkSize + slack`); `adapter.appendChunk`, update `uploadedBytes`, append `index` to `receivedChunks` (dedupe), set `lastChunkAt`.
- `GET /vault/uploads/:id` → `{ receivedChunks, uploadedBytes, chunkCount }`.
- `POST /vault/uploads/:id/finalize` →
  - verify `receivedChunks` covers `0..chunkCount-1`; else `409` and keep the session.
  - re-check quota against actual assembled size (`adapter.size` after finalize, or trust `uploadedBytes`).
  - `adapter.finalize`; resolve filename collision in the target dir among live files; `insert vault_files` (id = uploadId); `delete vault_uploads`; enqueue the thumbnail job (`getQueue("vault-thumbnails").add(...)` — consumed in Plan 2).
  - return the created file row + signed URLs.

- [ ] **Step 1:** Add a raw-body route registration for `PUT /vault/uploads/:id/chunks/:index` in `server.ts` (tsoa reads JSON by default; chunk bodies are binary). Use `app.use("/vault/uploads", express.raw({ type: "application/octet-stream", limit: "...mb" }))` **before** `RegisterRoutes`, OR read the stream directly in the controller via `@Request()`. Prefer the latter to avoid double-parsing: in the handler, read `req` as a stream and collect into a Buffer.
- [ ] **Step 2:** Implement; `ceil` via `Math.ceil`.
- [ ] **Step 3:** `bunx turbo build --filter=@cnet/api`.
- [ ] **Step 4:** Manual smoke: create upload → PUT 2 chunks → GET received → finalize → confirm a `vault_files` row + bytes on disk; test resume by skipping a chunk then finalizing (expect `409`).
- [ ] **Step 5: Gate + commit**

```bash
bunx biome check apps/api && bunx turbo build --filter=@cnet/api
git add apps/api && git commit -m "[agent] feat(api): chunked resumable vault uploads

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Files controller + signed-URL delivery (`@cnet/api`)

**Files:** Create `apps/api/src/controllers/vault-files.controller.ts` and `apps/api/src/controllers/vault-download.controller.ts`. Add a small `apps/api/src/vault/urls.ts` helper.

- [ ] **Step 1: `urls.ts`** — build signed URLs for a file:

```ts
import { signDownload, vaultSigningSecret } from "@cnet/core"

const TTL_MS = 24 * 60 * 60 * 1000

export function signedUrlsFor(userId: string, fileId: string, nowMs: number) {
  const secret = vaultSigningSecret()
  const exp = nowMs + TTL_MS
  const mk = (disposition: "inline" | "attachment") => {
    const sig = signDownload({ userId, fileId, exp, disposition }, secret)
    return `/vault/dl/${userId}/${fileId}?exp=${exp}&disp=${disposition}&sig=${sig}`
  }
  return { previewUrl: mk("inline"), downloadUrl: mk("attachment") }
}
```
> `Date.now()` is fine in app runtime (it's banned only in Workflow scripts). Pass it from the controller.

- [ ] **Step 2: `vault-files.controller.ts`** (scoped to `actorFrom(req).id`):
  - `GET /vault/files/:id` → file row + `signedUrlsFor`.
  - `POST /vault/files/:id/rename` `{ name }` → collision-resolved rename (DB only).
  - `POST /vault/files/:id/move` `{ directoryId }` → move (DB only), collision-resolved.
  - `DELETE /vault/files/:id` → soft-delete (`deletedAt`, `originalDirectoryId`).
  - `POST /vault/files/:id/restore` → restore to `originalDirectoryId` (or root if gone); collision-resolve with label `"restored"`.
  - `DELETE /vault/files/:id/permanent` → hard delete: `adapter.remove` + delete row.
  - `GET /vault/search?q=` → live files where `filename ILIKE %q%` (use `ilike`), scoped to owner.
  - `POST /vault/files/:id/star` / `DELETE .../star` and `POST .../color { color }` → upsert `vault_item_metadata`.
  - `GET /vault/starred` → joined starred files/dirs.
  - `GET /vault/trash` → soft-deleted files/dirs.

- [ ] **Step 3: `vault-download.controller.ts`** — the byte server (works in dev and prod):
  - `GET /vault/dl/:userId/:fileId` (no `@Security` — auth is the signature): read `exp,disp,sig` from query, `verifyDownload(..., Date.now())`; on failure `403`. On success, set `Content-Type` from the file row, `Content-Disposition` per `disp`, support `Range` via `adapter.createReadStream(userId, fileId, range)` and `206` with `Content-Range`. Use `@Request()`/`@Res()` to stream.
  - **Prod optimization (additive, no code):** `deploy/Caddyfile` may serve `/dl/*` directly from disk after `forward_auth` — see Task 11. The API endpoint remains the source of truth and the dev path.

- [ ] **Step 4:** `bunx turbo build --filter=@cnet/api`.
- [ ] **Step 5:** Manual smoke: list a folder, copy a `previewUrl`, GET it (inline) and the `downloadUrl` (attachment), test a `Range: bytes=0-3` request returns `206`; tamper `sig` → `403`; set `exp` in the past → `403`.
- [ ] **Step 6: Gate + commit**

```bash
bunx biome check apps/api && bunx turbo build --filter=@cnet/api
git add apps/api && git commit -m "[agent] feat(api): vault files, trash/restore, search, signed delivery

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Admin controller — the only cross-user bypass (`@cnet/api`)

**File:** Create `apps/api/src/controllers/admin-vault.controller.ts`.

`@Route("admin/vault")` `@Security("jwt")`. **Every** handler begins with `const actor = actorFrom(req); requireSuper(actor)`, then uses `req.params.userId` (path param) as `ownerUserId`. This is the **only** place a non-session `ownerUserId` is read.

Endpoints:
- `GET /admin/vault/users` → list allowlist users + their usage (`completedUsage`) + quota.
- `GET /admin/vault/:userId/directories?directoryId=` → browse anyone (reuse the directories listing logic, owner = `userId`).
- `GET /admin/vault/:userId/files/:id` → signed URLs for `userId`'s file.
- `DELETE /admin/vault/:userId/files/:id` → soft-delete any user's file.

- [ ] **Step 1:** Implement; factor shared listing logic into a function both `vault-directories.controller.ts` and this controller call (e.g. `apps/api/src/vault/listing.ts`), parameterized by `ownerUserId` — so the regular controller passes the session id and admin passes the path param.
- [ ] **Step 2: Audit assertion.** Grep the vault controllers: the only occurrences of an `ownerUserId` that is not `actor.id` must be inside `admin-vault.controller.ts` after `requireSuper`. Run:
  `bunx rg "ownerUserId" apps/api/src/controllers` and eyeball that the shared `listing.ts` takes `ownerUserId` as a parameter and is only called with a non-session id from the admin controller.
- [ ] **Step 3:** `bunx turbo build --filter=@cnet/api`.
- [ ] **Step 4:** Manual smoke: as a `storage` user, GET `/admin/vault/users` → `403`; as `super`, browse another user's dir.
- [ ] **Step 5: Gate + commit**

```bash
bunx biome check apps/api && bunx turbo build --filter=@cnet/api
git add apps/api && git commit -m "[agent] feat(api): isolated superuser admin vault controller

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Web role gate + Caddy + handover doc + env

**Files:** Modify `apps/web/lib/auth.config.ts`, create `apps/web/middleware.ts`, modify `deploy/Caddyfile`, create `docs/HANDOVER-tank-storage-proxmox.md`, document env.

- [ ] **Step 1: Allowlist gate + role claim** in `auth.config.ts`:
  - Replace the hard-coded email check in `signIn` with `isEmailAuthorized(userEmail)` from `@cnet/core`.
  - In `jwt`, set `token.role = getAllowlistEntry(token.email as string)?.role ?? "storage"`.
  - In `session`, set `session.user.role = token.role`.
  - Extend the next-auth module types for `role` (a `apps/web/types/next-auth.d.ts` augmentation).

- [ ] **Step 2: Route guard** `apps/web/middleware.ts` — redirect `storage` users to `/vault` for any non-vault, non-auth path:

```ts
import { auth } from "@/lib/auth.config"
import { NextResponse } from "next/server"

export default auth((req) => {
  const role = req.auth?.user?.role
  const { pathname } = req.nextUrl
  const isVault = pathname.startsWith("/vault") || pathname.startsWith("/api/auth")
  if (role === "storage" && !isVault) {
    return NextResponse.redirect(new URL("/vault", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```
> The `/vault` page itself is built in Plan 3; this guard is the security boundary and is safe to land now (it only redirects).

- [ ] **Step 3: Caddy `/dl/*` prod direct-serve** (additive) — add to `deploy/Caddyfile` inside the `:80` block, before the catch-all `handle`:

```
	# Signed vault downloads: validate the signature at the API, then serve
	# bytes straight from the tank mount (bypasses Node). Same signed-URL
	# contract the API enforces in dev.
	handle /vault/dl/* {
		forward_auth 127.0.0.1:4000 {
			uri /svc/vault/_authz{http.request.uri.path}?{http.request.uri.query}
			copy_headers Content-Type Content-Disposition
		}
		root * {$TANK_MOUNT_PATH}
		rewrite * /cnet/users{path.1}
		file_server {
			precompressed
		}
	}
```
> This requires an API `GET /vault/_authz/*` that mirrors the download authz and returns `200` + `Content-Type`/`Content-Disposition` headers without a body. If wiring `forward_auth` proves fiddly on the host, the API streaming endpoint (Task 9) already serves `/dl` correctly — the Caddy block is a pure optimization. Note this tradeoff in the handover.

- [ ] **Step 4: Handover doc** `docs/HANDOVER-tank-storage-proxmox.md` — see content block below.
- [ ] **Step 5: Env docs** — add `VAULT_ALLOWLIST`, `TANK_MOUNT_PATH`, `VAULT_SIGNING_SECRET`, `VAULT_UPLOAD_TTL_HOURS`, `VAULT_TRASH_TTL_DAYS` to `.env.example` (create if absent) with comments.
- [ ] **Step 6: Gate + commit**

```bash
bunx biome check apps/web deploy && bunx turbo build --filter=@cnet/web
git add apps/web deploy docs .env.example && git commit -m "[agent] feat(web): storage-role route guard, Caddy dl route, proxmox handover

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin feat/vault-storage
```

### Handover doc content (`docs/HANDOVER-tank-storage-proxmox.md`)

````markdown
# Handover: tank storage for C-Net (for the Proxmox-host Claude)

You run on the Proxmox host that serves Martin's website. C-Net (an LXC) needs
"tank main" mounted so its Vault feature can store per-user files. The app code is
done; these are the **host-side** steps only it cannot perform from inside the repo.

## Contract the app relies on
- The app reads `TANK_MOUNT_PATH` (env in the LXC) and stores files under
  `${TANK_MOUNT_PATH}/cnet/users/<userId>/...`. That directory must be writable by the
  LXC's mapped uid/gid.
- Per-user hard quota target: 1 TB (configurable; some users differ — see `VAULT_ALLOWLIST`).

## Step 1 — DISCOVER (do this first; do not assume)
You must find these out on THIS host — they are not knowable from the repo:
- Storage type + pool name: `zpool list`, `zfs list` (ZFS?) vs `vgs`, `lvs` (LVM?).
- The C-Net LXC id and its config: `pct list`, `pct config <id>`.
- Whether the LXC is **privileged or unprivileged** (`grep unprivileged /etc/pve/lxc/<id>.conf`).
  Unprivileged LXCs **cannot** run `zfs` quota commands themselves — the host sets quotas.
- Free space on the target pool.
**Report back** the chosen `TANK_MOUNT_PATH`, the pool name, and the storage type.

## Step 2 — BIND MOUNT (prescribed; substitute the discovered pool path + LXC id)
```bash
# host-tank-path = the dataset/dir you chose on the host, e.g. /tank/cnet
pct set <id> -mp0 <host-tank-path>,mp=/mnt/tank
# then set TANK_MOUNT_PATH=/mnt/tank in the LXC's C-Net .env
```

## Step 3 — PER-USER QUOTA BACKSTOP (prescribed; pick the branch that matches discovery)
ZFS:
```bash
zfs create <pool>/cnet/users/<userId>
zfs set quota=1T <pool>/cnet/users/<userId>
```
LVM (thin) fallback:
```bash
lvcreate -V 1T --thinpool <pool> -n cnet-<userId> <vg>
mkfs.ext4 /dev/<vg>/cnet-<userId>
# mount under <host-tank-path>/cnet/users/<userId>
```
If neither quota mechanism is available, tell Martin — the app still enforces a soft
quota in code, but there will be no hard backstop.

## Out of scope (already done in the repo)
Allowlist/roles, DB schema, upload/finalize endpoints, signed-URL delivery, the
`/vault/dl` route, the Vault UI. Do not touch app code.
````

---

## Self-review notes
- **Spec coverage:** roles/allowlist (T1, T11), 4 tables (T4), adapter (T5), upload+reaper-contract (T8; reaper job itself is Plan 2), delivery (T2/T9), trash/restore/collision (T3/T9), star/color/search (T9), admin isolation (T10), handover (T11). Thumbnails/purge/reaper **workers** are Plan 2; UI is Plan 3 — both intentionally deferred.
- **`writeThumb`** must use `writeFile` (overwrite), not `appendFile` — corrected inline in T5 Step 4.
- **Partial-unique-where-deleted** can't come from drizzle-kit `unique()`; raw SQL appended in T4 Step 7.
- **Range/streaming** lives in the API (`/vault/dl`) so it works in dev; Caddy direct-serve (T11) is an additive prod layer over the same signed-URL contract — a deliberate, documented softening of the spec's "bytes always bypass Node," chosen for dev/prod parity.
