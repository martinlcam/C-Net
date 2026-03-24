# C-Net: TSOA + Drizzle Monorepo Migration Design

**Date:** 2026-03-24
**Status:** Approved
**Approach:** Big Bang Migration (full restructure in one pass)

## Overview

Migrate C-Net from a Next.js monolith (App Router API routes, single-file Drizzle schema) to a Turborepo monorepo with a standalone Express + TSOA API server, split Drizzle schema, auto-generated typed API client, and isolated worker processes.

## Goals

- Separate API into Express + TSOA for typed controllers and OpenAPI spec generation
- Split Drizzle schema into per-table files in a shared `packages/db` package
- Auto-generate a typed API client from the OpenAPI spec for the frontend
- Isolate workers as a separate app with shared packages for domain logic
- Clean package boundaries: execution separation (apps), code sharing (packages)

## Monorepo Structure

```
cnet/
├── apps/
│   ├── web/                    # @cnet/web — Next.js 16 frontend (React 19)
│   ├── api/                    # @cnet/api — Express + TSOA (port 4000)
│   └── workers/                # @cnet/workers — BullMQ consumers/schedulers
├── packages/
│   ├── db/                     # @cnet/db — Drizzle schema, client, migrations
│   ├── core/                   # @cnet/core — env, logger, encryption, auth, redis, queues
│   ├── engine/                 # @cnet/engine — domain logic (Proxmox, audit, services)
│   └── api-client/             # @cnet/api-client — auto-generated typed client from OpenAPI
├── turbo.json
├── package.json                # Root workspace config (Bun)
├── tsconfig.base.json
├── biome.json
└── docker-compose.yml
```

## Package Details

### `packages/db` — @cnet/db

Drizzle ORM schema, client, and migrations.

```
packages/db/
├── src/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── accounts.ts
│   │   ├── sessions.ts
│   │   ├── verification-tokens.ts
│   │   ├── infrastructure-configs.ts
│   │   ├── service-credentials.ts
│   │   ├── audit-logs.ts
│   │   ├── metrics-snapshots.ts
│   │   ├── service-statuses.ts
│   │   └── index.ts              # re-exports all tables + enums
│   ├── client.ts                 # drizzle() client (node-postgres, SSL in prod)
│   ├── migrate.ts                # programmatic migration runner
│   └── index.ts                  # barrel export (client + schema)
├── drizzle.config.ts
├── migrations/
├── package.json
└── tsconfig.json
```

Schema style: standard Drizzle with chained constraints (`.notNull()`, `.unique()`, `.defaultRandom()`, etc.), one file per table.

Enums live in the schema file that primarily uses them. Shared enums go in `schema/enums.ts`.

The split schema files must remain compatible with `@auth/drizzle-adapter`. The `users`, `accounts`, `sessions`, and `verificationTokens` tables must use the exact column names and types expected by the adapter. `apps/web` imports both the `db` client and the schema tables to pass to `DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, ... })`.

Exports:
```ts
import { db } from "@cnet/db"
import { users, serviceCredentials } from "@cnet/db/schema"
```

### `packages/core` — @cnet/core

Shared infrastructure utilities.

```
packages/core/src/
├── env.ts              # Environment variable loading & validation (uses dotenv)
├── logger.ts           # Logger
├── encryption.ts       # AES-256-GCM encrypt/decrypt
├── redis.ts            # ioredis client setup (drop unused `redis` package)
├── queues.ts           # BullMQ queue definitions & config
├── authorization.ts    # Email-whitelist authorization logic (from lib/authorization.ts)
├── auth/
│   ├── jwt.ts          # NextAuth JWE/JWS token decryption & verification (see Auth section)
│   └── types.ts        # Auth types (session user, JWT payload shape)
├── types/
│   └── api.ts          # Shared API response types (ApiResponse, ApiError, PaginatedResponse)
└── index.ts
```

### `packages/engine` — @cnet/engine

Shared business/domain logic used by both API and workers.

```
packages/engine/src/
├── proxmox/
│   ├── service.ts      # ProxmoxService class (Axios) — instantiated per-request with user credentials
│   ├── test.ts          # Proxmox connection testing (from lib/proxmox-test.ts)
│   └── types.ts         # Proxmox API types (from lib/types/proxmox.ts)
├── audit/
│   └── logger.ts        # Audit log helper (writes to audit_logs table)
├── services/
│   ├── connectivity.ts  # Service connectivity tests (from lib/service-test.ts)
│   └── types.ts         # Service types (from lib/types/services.ts)
├── email/
│   ├── resend.ts        # Resend email client (from lib/resend.ts)
│   └── templates/       # Email templates (ContactEmailTemplate — rendered via react-email)
└── index.ts
```

**Important:** `ProxmoxService` is NOT a singleton. It is instantiated per-request with the authenticated user's stored credentials (host, user, token). Controllers must fetch the user's `infrastructureConfig` from the DB and construct a `ProxmoxService` instance. This matches the current behavior.

### `packages/api-client` — @cnet/api-client

Auto-generated typed API client from the OpenAPI spec.

- **Codegen tool:** `orval` — generates typed fetch functions with request/response types. Chosen over `openapi-typescript` (types-only) because it produces a full callable client.
- Turborepo pipeline: `@cnet/api#build` → `@cnet/api-client#codegen`
- Consumed by `@cnet/web`

## App Details

### `apps/api` — @cnet/api

Express + TSOA API server running on **port 4000**.

```
apps/api/src/
├── controllers/
│   ├── proxmox.controller.ts         # Nodes, VMs, start/stop/restart — @Security("jwt")
│   ├── metrics.controller.ts         # Current metrics — @Security("jwt")
│   ├── infrastructure.controller.ts  # Proxmox config CRUD — @Security("jwt")
│   ├── services.controller.ts        # Service credentials CRUD + test — @Security("jwt")
│   ├── jobs.controller.ts            # Job triggers + status — @Security("jwt")
│   ├── contact.controller.ts         # Contact form — PUBLIC (no @Security)
│   └── health.controller.ts          # GET /health — PUBLIC (no @Security)
├── middleware/
│   ├── auth.middleware.ts            # JWT verify + TSOA @Security handler
│   └── error.middleware.ts           # Global error handler
├── generated/                        # gitignored
│   ├── routes.ts                     # TSOA-generated Express routes
│   └── swagger.json                  # TSOA-generated OpenAPI spec
├── server.ts                         # Express app setup, CORS, register routes
└── index.ts                          # Entry point (listen on :4000)
```

**Public vs protected endpoints:** `ContactController` and `HealthController` are public — they do NOT use `@Security("jwt")`. All other controllers use `@Security("jwt")` at the class level.

**TSOA build step:** `tsoa spec-and-routes` must run BEFORE `tsc`. TSOA is a code generator, not a TypeScript compiler plugin. It reads controller decorators and generates `routes.ts` + `swagger.json` into `src/generated/`. The `api:generate` script runs this, and the `build` task depends on it.

**Request validation:** TSOA's built-in validation via TypeScript interfaces replaces Zod for request body validation. TSOA validates request bodies, query params, and path params against the controller method signatures at runtime. Zod is removed from the API layer.

**CORS configuration** in `server.ts`:
- Allowed origins: `http://localhost:3001` (dev), production domain (from env var `CORS_ORIGIN`)
- Credentials: `true` (allows `Authorization` header)
- Methods: `GET, POST, PUT, DELETE, OPTIONS`

TSOA controller example:
```ts
import { Controller, Get, Post, Route, Security, Path, Request } from "tsoa"
import { ProxmoxService } from "@cnet/engine"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import { eq } from "drizzle-orm"
import { decrypt } from "@cnet/core"

@Route("proxmox")
@Security("jwt")
export class ProxmoxController extends Controller {
  @Get("nodes")
  async getNodes(@Request() req: Express.Request) {
    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, req.user.id),
    })
    const proxmox = new ProxmoxService({
      host: config.proxmoxHost,
      user: config.proxmoxUser,
      token: decrypt(config.proxmoxToken),
    })
    return proxmox.getNodes()
  }
}
```

Dev startup preflight warnings:
- `⚠ Database not reachable at DATABASE_URL — API will fail on DB queries`
- `⚠ Redis not reachable — job queues will not function`

**Health endpoint:** `GET /health` returns `{ status: "ok", timestamp }`. Used by Docker health checks.

### `apps/web` — @cnet/web

Next.js 16 frontend. Minimal changes.

**Removed:**
- All `/api/*` route handlers except `/api/auth/[...nextauth]`
- `lib/services/`, `lib/db/`, `lib/encryption.ts`, `lib/redis.ts`, `lib/queues.ts`, `lib/audit.ts`, `lib/service-test.ts`, `lib/resend.ts`, `lib/proxmox-test.ts`, `lib/authorization.ts`
- `lib/types/` (moved to `@cnet/core` and `@cnet/engine`)

**Added:**
- Import `@cnet/api-client` for typed API calls
- JWT header injection wrapper (attaches NextAuth session token as `Authorization: Bearer` header)

**Stays in `apps/web` (not moved to packages):**
- NextAuth config (`auth.config.ts`, `auth.ts`, `[...nextauth]` route)
- Zustand stores (`lib/stores/auth-modal.ts`)
- Frontend-only utils (`cn()` from `lib/utils.ts` for Tailwind class merging)
- Storybook config (`.storybook/`, `stories/`)
- All React components, pages, layouts
- Tailwind, Radix UI

**Shared utils split:** `lib/utils.ts` is split — `cn()` stays in `apps/web`, while `formatBytes()`, `formatPercent()`, `getClientIp()` move to `@cnet/core`.

### `apps/workers` — @cnet/workers

BullMQ consumers/schedulers. Logic unchanged, imports updated.

```
apps/workers/src/
├── workers/
│   ├── metrics-collector.ts
│   ├── health-checker.ts
│   ├── backup-runner.ts
│   ├── cleanup.ts
│   ├── notification-sender.ts
│   └── service-integrations.ts
├── index.ts                      # Worker registration
└── worker.ts                     # Docker entrypoint
```

Imports change from relative `../../lib/*` to `@cnet/db`, `@cnet/core`, `@cnet/engine`.

## Authentication

OAuth flow is unchanged. NextAuth in `apps/web` handles Google OAuth sign-in and issues JWT session tokens.

### NextAuth JWT Strategy Override (Critical)

NextAuth v5 defaults to **JWE tokens** (encrypted with HKDF-derived keys, `A256CBC-HS512`). Replicating this decryption in Express is fragile — the HKDF salt is the cookie name, the info string changed between v4 and v5, and Auth.js explicitly discourages decoding their tokens in external services.

**Solution:** Override NextAuth's `encode`/`decode` to use standard signed JWTs instead of JWE. This is the approach Auth.js recommends for cross-service authentication.

In `apps/web/lib/auth.config.ts`, add:
```ts
import jwt from "jsonwebtoken"

export const authConfig: NextAuthConfig = {
  // ...existing config
  jwt: {
    encode({ token, secret }) {
      return jwt.sign(token!, secret as string)
    },
    decode({ token, secret }) {
      return jwt.verify(token!, secret as string) as JWT
    },
  },
}
```

Then in the Express API, verification is trivial:
```ts
// packages/core/src/auth/jwt.ts
import jwt from "jsonwebtoken"

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, process.env.NEXTAUTH_SECRET!) as JWTPayload
}
```

**Expected JWT payload shape:**
```ts
interface JWTPayload {
  sub: string        // user ID (UUID)
  id: string         // user ID (set by jwt callback)
  email: string
  name: string
  iat: number
  exp: number
}
```

**Auth middleware flow:**
1. Extract `Bearer <token>` from `Authorization` header
2. `jwt.verify(token, NEXTAUTH_SECRET)` → payload
3. Populate `req.user = { id: payload.id, email: payload.email, name: payload.name }`
4. TSOA's `@Security("jwt")` wires this middleware to protected controllers

**Note:** This override changes existing session tokens. After deploying, existing sessions will be invalidated and users must sign in again. For a single-user homelab, this is a non-issue.

Google Cloud Console config unchanged — same client ID, same redirect URIs.

## TypeScript Configuration

**`tsconfig.base.json`** at root: shared `compilerOptions` (target, module, strict mode, etc.).

Each package/app extends it:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Path aliases:**
- Packages do NOT use path aliases — they import other packages by name (`@cnet/db`, `@cnet/core`, `@cnet/engine`)
- `apps/web` keeps its `@/` alias for internal code (components, hooks, etc.)
- `apps/api` and `apps/workers` use package name imports only

## Dev Experience

Root scripts:
```json
{
  "dev": "turbo dev",
  "dev:web": "turbo dev --filter=@cnet/web",
  "dev:api": "turbo dev --filter=@cnet/api",
  "dev:workers": "turbo dev --filter=@cnet/workers",
  "build": "turbo build",
  "lint": "biome check .",
  "format": "biome check --write .",
  "db:generate": "turbo db:generate --filter=@cnet/db",
  "db:migrate": "turbo db:migrate --filter=@cnet/db",
  "db:studio": "turbo db:studio --filter=@cnet/db"
}
```

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": [
    "DATABASE_URL",
    "REDIS_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_ID",
    "GOOGLE_SECRET",
    "ENCRYPTION_PASSWORD",
    "NODE_ENV",
    "CORS_ORIGIN"
  ],
  "tasks": {
    "api:generate": {
      "dependsOn": ["^build"],
      "outputs": ["src/generated/**"]
    },
    "build": {
      "dependsOn": ["^build", "api:generate"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "codegen": {
      "dependsOn": ["@cnet/api#api:generate"],
      "outputs": ["src/generated/**"]
    },
    "lint": {},
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:studio": {
      "persistent": true,
      "cache": false
    }
  }
}
```

**Environment variables:**
- `.env` at root for local dev
- Express apps load env vars via `@cnet/core/env.ts` which calls `dotenv.config()` pointing to the root `.env`
- Next.js loads `.env` automatically (built-in)
- Turborepo `globalEnv` ensures cache invalidation when env vars change

**Env var ownership:**
| Variable | web | api | workers |
|---|---|---|---|
| `DATABASE_URL` | yes (NextAuth adapter) | yes | yes |
| `REDIS_URL` | no | yes | yes |
| `NEXTAUTH_SECRET` | yes | yes (JWT verify) | no |
| `GOOGLE_ID` | yes | no | no |
| `GOOGLE_SECRET` | yes | no | no |
| `ENCRYPTION_PASSWORD` | no | yes | yes |
| `NODE_ENV` | yes | yes | yes |
| `CORS_ORIGIN` | no | yes | no |

Package manager: Bun (unchanged).
Formatter/linter: Biome (config at root, shared).

## Production Deployment

Docker Compose on homelab (Proxmox VM/container):

```yaml
services:
  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    ports: ["3001:3001"]
    env_file: .env
    depends_on: [postgres]

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    ports: ["4000:4000"]
    env_file: .env
    depends_on: [postgres, redis]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  workers:
    build: { context: ., dockerfile: apps/workers/Dockerfile }
    env_file: .env
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16
    volumes: ["pg_data:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    volumes: ["redis_data:/data"]
```

**Dockerfiles:** Each app uses a multi-stage build with `oven/bun` as the base image. `turbo prune @cnet/<app>` creates minimal Docker contexts with only the needed packages.

**`web` depends on `postgres`** because NextAuth with DrizzleAdapter needs the database at startup.

NAS access is through the Proxmox PVE API (via `@cnet/engine`), not direct volume mounts.

## CI/CD

The existing GitHub Actions CI (`ci.yml`) must be updated:
- Replace `bun run build` with `turbo build`
- Replace `bun run lint:check` with `turbo lint`
- Replace `bun run type-check` with `turbo build` (TypeScript checking happens during build)
- Add `turbo codegen` step for API client generation

## API Endpoints (migrated to TSOA controllers)

| Current Next.js Route | TSOA Controller | Method | Auth |
|---|---|---|---|
| `/api/proxmox/nodes` | `ProxmoxController` | `GET /proxmox/nodes` | JWT |
| `/api/proxmox/vms` | `ProxmoxController` | `GET /proxmox/vms` | JWT |
| `/api/proxmox/vms/[vmid]/start` | `ProxmoxController` | `POST /proxmox/vms/{vmid}/start` | JWT |
| `/api/proxmox/vms/[vmid]/stop` | `ProxmoxController` | `POST /proxmox/vms/{vmid}/stop` | JWT |
| `/api/proxmox/vms/[vmid]/restart` | `ProxmoxController` | `POST /proxmox/vms/{vmid}/restart` | JWT |
| `/api/metrics/current` | `MetricsController` | `GET /metrics/current` | JWT |
| `/api/infrastructure/config` | `InfrastructureController` | `GET/POST /infrastructure/config` | JWT |
| `/api/services/credentials` | `ServicesController` | `GET/POST /services/credentials` | JWT |
| `/api/services/credentials/[id]` | `ServicesController` | `PATCH/DELETE /services/credentials/{id}` | JWT |
| `/api/services/credentials/test` | `ServicesController` | `POST /services/credentials/test` | JWT |
| `/api/jobs/trigger` | `JobsController` | `POST /jobs/trigger` | JWT |
| `/api/jobs/metrics` | `JobsController` | `GET /jobs/metrics` | JWT |
| `/api/jobs/status` | `JobsController` | `GET /jobs/status` | JWT |
| `/api/contact` | `ContactController` | `POST /contact` | Public |
| — (new) | `HealthController` | `GET /health` | Public |

## File Placement Reference

Complete mapping of existing `lib/` files to their new locations:

| Current Location | New Location |
|---|---|
| `lib/db/schema.ts` | `packages/db/src/schema/*.ts` (split per table) |
| `lib/db/client.ts` | `packages/db/src/client.ts` |
| `lib/db/migrations/` | `packages/db/migrations/` |
| `lib/encryption.ts` | `packages/core/src/encryption.ts` |
| `lib/logger.ts` | `packages/core/src/logger.ts` |
| `lib/redis.ts` | `packages/core/src/redis.ts` |
| `lib/queues.ts` | `packages/core/src/queues.ts` |
| `lib/authorization.ts` | `packages/core/src/authorization.ts` |
| `lib/utils.ts` → `cn()` | `apps/web/lib/utils.ts` (stays) |
| `lib/utils.ts` → `formatBytes`, etc. | `packages/core/src/utils.ts` |
| `lib/types/api.ts` | `packages/core/src/types/api.ts` |
| `lib/types/proxmox.ts` | `packages/engine/src/proxmox/types.ts` |
| `lib/types/services.ts` | `packages/engine/src/services/types.ts` |
| `lib/services/proxmox.ts` | `packages/engine/src/proxmox/service.ts` |
| `lib/audit.ts` | `packages/engine/src/audit/logger.ts` |
| `lib/service-test.ts` | `packages/engine/src/services/connectivity.ts` |
| `lib/proxmox-test.ts` | `packages/engine/src/proxmox/test.ts` |
| `lib/resend.ts` | `packages/engine/src/email/resend.ts` |
| `lib/auth.ts` | `apps/web/lib/auth.ts` (stays — NextAuth helpers) |
| `lib/auth.config.ts` | `apps/web/lib/auth.config.ts` (stays) |
| `lib/stores/auth-modal.ts` | `apps/web/lib/stores/auth-modal.ts` (stays) |
| `lib/workers/*.ts` | `apps/workers/src/workers/*.ts` |
| `lib/scripts/start-workers.ts` | `apps/workers/src/worker.ts` |
| `components/ContactEmailTemplate.tsx` | `packages/engine/src/email/templates/` |
| `.storybook/`, `stories/` | `apps/web/.storybook/`, `apps/web/stories/` (stays) |
| `drizzle.config.ts` | `packages/db/drizzle.config.ts` |

## Migration Strategy

Big bang: restructure the entire project in one pass. The API surface is small (~14 endpoints), making this tractable. No hybrid state with two API servers.

**Highest-risk item:** NextAuth JWE token verification in Express middleware. Test this in isolation before wiring up all controllers.

## Non-Goals

- Changing the database schema structure (tables, columns, relations stay the same)
- Changing the frontend UI or component architecture
- Changing worker job logic or scheduling
- Changing the OAuth provider or auth strategy
- Direct NAS volume mounts (NAS accessed via Proxmox API)
- API versioning (can be added later if needed)
