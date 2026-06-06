# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

C-Net — a self-hosted homelab dashboard. Bun-managed Turborepo (Bun is both package manager and runtime).

**Apps:**
- `@cnet/web` — Next.js 16 frontend (port 3001), next-auth (Google OAuth), Radix UI, Tailwind, TanStack Query
- `@cnet/api` — Express + tsoa REST API (port 4000), Drizzle, BullMQ producer
- `@cnet/realtime` — Bun WebSocket fan-out (port 4002), subscribes to Redis pub/sub
- `@cnet/workers` — BullMQ job workers
- `@cnet/neural-bridge` — Python (`bleak`) Muse 2 BLE → Redis pub/sub; intentionally outside the JS monorepo

**Packages:** `@cnet/core` (shared utils, env), `@cnet/db` (Drizzle ORM + migrations), `@cnet/engine`, `@cnet/api-client`

## Commands

```bash
bun install              # Install dependencies
bun run dev              # All apps via turbo (dev:web / dev:api / dev:workers for one)
bun run build            # turbo build (also the type-check gate — runs tsoa codegen + tsc + next build)
bun run lint             # Biome check + Sonar (if configured)
bun run lint:check       # Biome check only (CI uses this)
bun run format           # Biome check --write (auto-fix)

# Database (local Postgres + Redis via Docker)
bun run db:start         # Start containers
bun run db:stop          # Stop containers
bun run db:reset         # Wipe + restart
bun run db:generate      # Generate Drizzle migrations
bun run db:migrate       # Apply migrations
bun run db:studio        # Drizzle Studio

bun run bridge           # Run the Python neural-bridge
```

## Architecture notes

- **API mounting:** `apps/api/src/server.ts` builds the Express app; tsoa `RegisterRoutes(app)` mounts controllers from `apps/api/src/controllers/**/*.controller.ts` **at root** (e.g. `/proxmox`, `/metrics`, `/services`, `/health`). Routes are generated into `apps/api/src/generated/` — never hand-edit generated files. After changing controller signatures, run `bun run build` (or `turbo build`) to regenerate routes + the OpenAPI spec.
- **Frontend → API:** the web app calls `${NEXT_PUBLIC_API_URL}${path}` (default `http://localhost:4000`) with `credentials: "include"`; auth flows through the next-auth session cookie.
- **Realtime:** the bridge publishes JSON frames to Redis channels `bd:samples` / `bd:status`; `apps/realtime` subscribes and fans them out to `/bd/live` WebSocket viewers. Frame shapes are intentionally never reshaped on either side.
- **Deployment:** see `docs/superpowers/specs/2026-06-06-proxmox-migration-design.md` and `docs/RUNBOOK-proxmox-deploy.md` for the Proxmox/self-hosting setup.

## Code Style

- Use `type X = { ... }` for object shapes. Reach for `interface` only when you need declaration merging.
- Biome is the linter/formatter. After making changes, run `bun run lint:check` (or `bun run format` to auto-fix) and fix lint errors **in the files you touched**. Leave unrelated findings for their owners.
- Any files the formatter rewrites are your responsibility — commit them as part of the current step or a final `chore: lint` commit.
- Let whitespace and function boundaries structure code; comments should explain *why*, not divide regions.
- Match the surrounding code's naming, comment density, and idioms.

## Quality before merge

Run `bun run lint:check` and `bunx turbo build` (the type-check + build gate) before pushing. These mirror the CI jobs in `.github/workflows/ci.yml` (`format`, `lint`, `type-check`, `build`, plus `commitlint`, `bugcat`, `sonarqube`).

## Git Workflow

- Always create new commits without amending. Commit frequently.
- Branch off `main`; never force-push unless explicitly asked.
- Run lint + build before pushing; open PRs with `gh pr create`.
- Resolve the current PR from the branch when none is given:
  ```bash
  gh pr list --head "$(git branch --show-current)" --json number,url,title --jq '.[0]'
  ```

### Commit messages

CI runs commitlint (`commitlint.config.js` extends `@commitlint/config-conventional`):

- **Header:** `[agent] <type>(<scope>): <subject>` — max **100 chars**. Allowed types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `ci`, `deps`, `style`, `security`, `fml`.
- **Body lines:** max **100 chars each**. Wrap long paragraphs — a single long line is the most common reason commitlint fails on agent commits.
- **Footer lines** (e.g. `Co-Authored-By:`): same 100-char limit.

## Agent Attribution

All git commits, PR titles/bodies, PR/issue/review comments, and other public-facing GitHub text authored by an agent must:

1. **Prefix** the content with `[agent]`.
2. **End** with a `Co-Authored-By:` line naming YOUR actual model and vendor:
   - Anthropic: `Co-Authored-By: Claude <model> <noreply@anthropic.com>` (e.g. `Claude Opus 4.8 (1M context)`)
   - OpenAI: `Co-Authored-By: <model> <noreply@openai.com>`
   - Google: `Co-Authored-By: <model> <noreply@google.com>`

Use your real identity — do not blend vendor names or borrow another vendor's email.
