# Vault Plan 3 — Frontend UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** A native-feeling Vault UI at `/vault` (file browser, chunked upload, downloads, trash, search, star) plus a superuser `/admin/vault` view, wired to the Plan 1 API.

**Architecture:** Next.js App Router pages matching the existing `/cnet` pattern — a server `layout.tsx` guarded by `requireAuthorizedEmail()`, a client nav that conditionally shows Admin for `role === "super"`, and client pages using TanStack Query against the API via `fetch(..., { credentials: "include" })`. UI uses the repo's `@/stories/*` components (Button, Dialog) + Tailwind tokens + `lucide-react`.

**Tech Stack:** Next 16, React 19, TanStack Query, next-auth `useSession`, `@/stories/button`, `@/stories/dialog`, lucide-react.

**Gate per task:** `bunx biome check .` + `cd apps/web && bunx tsc --noEmit`.

---

## Task 1: Vault API client (`apps/web/lib/vault-api.ts`)
- [ ] Types: `VaultFile`, `VaultDir`, `Breadcrumb`, `DirectoryListing`, `AdminUser`.
- [ ] `vaultUrl(path)` = `${API_BASE}${path}` for signed download/preview links.
- [ ] Fetch helpers (all `credentials: "include"`): `listDir(directoryId?)`, `createDir(parentId, name)`, `renameDir`, `deleteDir`, `getFile`, `renameFile`, `moveFile`, `deleteFile`, `restoreFile`, `purgeFile`, `starFile`, `unstarFile`, `search(q)`, `getTrash()`, `getStarred()`, admin `adminUsers()`, `adminListDir(userId, directoryId?)`.
- [ ] `uploadFile(file, directoryId, onProgress)`: POST `/vault/uploads` → PUT each chunk (`application/octet-stream`, `file.slice`) → POST finalize; report progress.
- [ ] Gate + commit.

## Task 2: Layout + nav (`apps/web/app/vault/layout.tsx`, `nav.tsx`)
- [ ] Server `layout.tsx`: `requireAuthorizedEmail()` (redirect to signin on throw), sidebar shell matching `/cnet/layout.tsx` (`bg-[#faf6f1]`, `w-64` aside), renders `<VaultNav/>` + `<SignOutButton/>`.
- [ ] Client `nav.tsx` (`"use client"`): `useSession()`; links Files (`/vault`), Trash (`/vault/trash`), and Admin (`/admin/vault`) only when `role === "super"`. Active link highlight via `usePathname`.
- [ ] Gate + commit.

## Task 3: File browser (`apps/web/app/vault/page.tsx` + `_components/`)
- [ ] `page.tsx` (`"use client"`): `useQuery(["vault","dir",directoryId])` → listing. Breadcrumb bar (clickable), folder grid/rows (click to navigate), file rows (icon, name, size, actions).
- [ ] Toolbar: search input (debounced → `["vault","search",q]`), "New folder" (Dialog), "Upload" (hidden file input, multi-file, chunked via `uploadFile` with a progress list).
- [ ] File actions (inline buttons or menu): Download (open `vaultUrl(downloadUrl)`), Rename (Dialog), Delete (→ trash), Star toggle.
- [ ] Folder actions: open, Rename, Delete.
- [ ] Mutations invalidate `["vault","dir",directoryId]`. Loading via `LoadingSpinner`; errors via the inline `bg-accent-red-10` pattern.
- [ ] Gate + commit.

## Task 4: Trash (`apps/web/app/vault/trash/page.tsx`)
- [ ] `useQuery(["vault","trash"])`; list trashed files; Restore + Delete-forever buttons; invalidate on success.
- [ ] Gate + commit.

## Task 5: Admin (`apps/web/app/admin/vault/page.tsx` + client)
- [ ] Server page: `getServerAuthSession()`; redirect unless `role === "super"`. Renders client `<AdminVault/>`.
- [ ] Client: `useQuery(["vault","admin","users"])` → table of email/role/quota/usage (format bytes). Selecting a user with a `userId` loads `adminListDir(userId)` read-only (names + sizes).
- [ ] Gate + commit + push.

## Self-review
- Storage users reach only `/vault*` (middleware from Plan 1 + this layout). Admin gated twice (middleware nav hidden + server role check). Chunked upload matches the Plan 1 upload contract (octet-stream chunks, finalize).
