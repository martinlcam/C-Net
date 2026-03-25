# TSOA + Drizzle Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate C-Net from a Next.js monolith to a Turborepo monorepo with Express + TSOA API server, split Drizzle schema, auto-generated typed API client, and isolated workers.

**Architecture:** Turborepo workspaces with three apps (`web`, `api`, `workers`) and four packages (`db`, `core`, `engine`, `api-client`). Express + TSOA serves the API on port 4000, Next.js serves the frontend on 3001, BullMQ workers run as a separate process. All share code through `@cnet/*` packages.

**Tech Stack:** TypeScript, Turborepo, Bun, Express, TSOA, Drizzle ORM, PostgreSQL, BullMQ, ioredis, NextAuth v5, orval, Biome

**Spec:** `docs/superpowers/specs/2026-03-24-tsoa-drizzle-migration-design.md`

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root — replace existing)
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `apps/web/`, `apps/api/`, `apps/workers/`, `packages/db/`, `packages/core/`, `packages/engine/`, `packages/api-client/` (directories)
- Modify: `biome.json` (stays at root, no change needed)

- [ ] **Step 1: Create root `package.json` with workspaces**

```json
{
  "name": "cnet",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "turbo dev --filter=@cnet/web",
    "dev:api": "turbo dev --filter=@cnet/api",
    "dev:workers": "turbo dev --filter=@cnet/workers",
    "build": "turbo build",
    "lint": "biome check .",
    "lint:check": "biome check .",
    "format": "biome check --write .",
    "db:generate": "turbo db:generate --filter=@cnet/db",
    "db:migrate": "turbo db:migrate --filter=@cnet/db",
    "db:studio": "turbo db:studio --filter=@cnet/db"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.11",
    "turbo": "^2.5.0",
    "typescript": "^5.9.2"
  },
  "engines": {
    "node": ">=20.9.0",
    "bun": ">=1.3.4"
  }
}
```

- [ ] **Step 2: Create `turbo.json`**

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
    "CORS_ORIGIN",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_API_URL",
    "API_PORT"
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

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": false,
    "incremental": false
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create all directories**

```bash
mkdir -p apps/web apps/api/src/{controllers,middleware,generated} apps/workers/src/workers
mkdir -p packages/db/src/schema packages/db/migrations
mkdir -p packages/core/src/{auth,types}
mkdir -p packages/engine/src/{proxmox,audit,services,email/templates}
mkdir -p packages/api-client/src/generated
```

- [ ] **Step 5: Install root dependencies**

```bash
bun install
```

This installs turbo, biome, and typescript at the root. Rerun `bun install` at the root after creating each new workspace `package.json` in subsequent tasks to link workspace packages.

- [ ] **Step 6: Commit**

```bash
git add package.json turbo.json tsconfig.base.json bun.lock
git commit -m "feat: scaffold Turborepo monorepo structure"
```

---

## Task 2: `packages/db` — Split Schema and Client

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/accounts.ts`
- Create: `packages/db/src/schema/sessions.ts`
- Create: `packages/db/src/schema/verification-tokens.ts`
- Create: `packages/db/src/schema/infrastructure-configs.ts`
- Create: `packages/db/src/schema/service-credentials.ts`
- Create: `packages/db/src/schema/audit-logs.ts`
- Create: `packages/db/src/schema/metrics-snapshots.ts`
- Create: `packages/db/src/schema/service-statuses.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/src/index.ts`
- Move: `lib/db/migrations/` → `packages/db/migrations/`

**Source reference:** Current schema is at `lib/db/schema.ts` (205 lines). Current client is at `lib/db/client.ts` (12 lines).

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@cnet/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.7",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "@types/pg": "^8.11.10",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 4: Split schema into per-table files**

Extract each table from `lib/db/schema.ts` into its own file. Each file contains the table definition, its relations, and any enums it primarily uses.

**`packages/db/src/schema/users.ts`** — Extract `users` table + `usersRelations`:
```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { accounts } from "./accounts"
import { sessions } from "./sessions"
import { infrastructureConfigs } from "./infrastructure-configs"
import { serviceCredentials } from "./service-credentials"
import { auditLogs } from "./audit-logs"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  googleId: text("google_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  infrastructureConfigs: many(infrastructureConfigs),
  serviceCredentials: many(serviceCredentials),
  auditLogs: many(auditLogs),
}))
```

**`packages/db/src/schema/accounts.ts`** — Extract `accounts` table + relations.

**`packages/db/src/schema/sessions.ts`** — Extract `sessions` table + relations.

**`packages/db/src/schema/verification-tokens.ts`** — Extract `verificationTokens` table.

**`packages/db/src/schema/infrastructure-configs.ts`** — Extract `infrastructureConfigs` table + relations.

**`packages/db/src/schema/service-credentials.ts`** — Extract `serviceCredentials` table + `serviceEnum` + relations.

**`packages/db/src/schema/audit-logs.ts`** — Extract `auditLogs` table + `auditActionEnum` + `logStatusEnum` + relations + indexes.

**`packages/db/src/schema/metrics-snapshots.ts`** — Extract `metricsSnapshots` table + indexes.

**`packages/db/src/schema/service-statuses.ts`** — Extract `serviceStatuses` table + `statusEnum`.

For each file, copy the exact column definitions from `lib/db/schema.ts`. Keep column names, types, constraints, and defaults identical to avoid schema drift.

- [ ] **Step 5: Create `packages/db/src/schema/index.ts`**

Re-export everything:
```ts
export { users, usersRelations } from "./users"
export { accounts, accountsRelations } from "./accounts"
export { sessions, sessionsRelations } from "./sessions"
export { verificationTokens } from "./verification-tokens"
export { infrastructureConfigs, infrastructureConfigsRelations } from "./infrastructure-configs"
export { serviceCredentials, serviceCredentialsRelations, serviceEnum } from "./service-credentials"
export { auditLogs, auditLogsRelations, auditActionEnum, logStatusEnum } from "./audit-logs"
export { metricsSnapshots } from "./metrics-snapshots"
export { serviceStatuses, statusEnum } from "./service-statuses"
```

- [ ] **Step 6: Create `packages/db/src/client.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema/index"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
})

export const db = drizzle(pool, { schema })
export type Database = typeof db
```

- [ ] **Step 7: Create `packages/db/src/migrate.ts`**

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { db } from "./client"

async function main() {
  console.log("Running migrations...")
  await migrate(db, { migrationsFolder: "./migrations" })
  console.log("Migrations complete.")
  process.exit(0)
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
```

- [ ] **Step 8: Create `packages/db/src/index.ts`**

```ts
export { db, type Database } from "./client"
export * from "./schema/index"
```

- [ ] **Step 9: Copy migrations**

```bash
cp -r lib/db/migrations/* packages/db/migrations/
```

- [ ] **Step 10: Install and verify schema split compiles**

```bash
cd ../.. && bun install
cd packages/db && bun tsc --noEmit
```

Expected: no errors. If there are circular import issues between schema files (e.g., users imports accounts for relations, accounts imports users), resolve by using type-only imports or moving relations to a separate `relations.ts` file.

- [ ] **Step 11: Commit**

```bash
git add packages/db/
git commit -m "feat(db): split Drizzle schema into per-table files with shared package"
```

---

## Task 3: `packages/core` — Shared Infrastructure

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/env.ts`
- Create: `packages/core/src/logger.ts` (from `lib/logger.ts`)
- Create: `packages/core/src/encryption.ts` (from `lib/encryption.ts`)
- Create: `packages/core/src/redis.ts` (from `lib/redis.ts`)
- Create: `packages/core/src/queues.ts` (from `lib/queues.ts`)
- Create: `packages/core/src/authorization.ts` (simplified — no NextAuth dependency)
- Create: `packages/core/src/utils.ts` (shared utils only)
- Create: `packages/core/src/auth/jwt.ts`
- Create: `packages/core/src/auth/types.ts`
- Create: `packages/core/src/types/api.ts` (from `lib/types/api.ts`)
- Create: `packages/core/src/index.ts`

**Source references:**
- `lib/encryption.ts` (70 lines) — copy as-is, no import changes needed (uses only node:crypto)
- `lib/logger.ts` (51 lines) — copy as-is (uses only console)
- `lib/redis.ts` (81 lines) — copy as-is (uses only ioredis)
- `lib/queues.ts` (126 lines) — copy as-is (uses only bullmq)
- `lib/types/api.ts` (21 lines) — copy as-is (no imports)
- `lib/utils.ts` — extract `formatBytes`, `formatPercent`, `getClientIp` only (not `cn`)
- `lib/authorization.ts` — rewrite to NOT depend on NextAuth session

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@cnet/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./env": "./src/env.ts"
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "bullmq": "^5.66.5",
    "dotenv": "^16.4.7",
    "ioredis": "^5.4.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.9",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/src/env.ts`**

```ts
import dotenv from "dotenv"
import { resolve } from "node:path"

dotenv.config({ path: resolve(process.cwd(), "../../.env") })

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
```

- [ ] **Step 4: Copy `lib/encryption.ts` → `packages/core/src/encryption.ts`**

Copy verbatim — this file has no internal imports, only `node:crypto` and `node:util`.

- [ ] **Step 5: Copy `lib/logger.ts` → `packages/core/src/logger.ts`**

Copy verbatim — no internal imports.

- [ ] **Step 6: Copy `lib/redis.ts` → `packages/core/src/redis.ts`**

Copy verbatim — only imports `ioredis`.

- [ ] **Step 7: Copy `lib/queues.ts` → `packages/core/src/queues.ts`**

Copy verbatim — only imports `bullmq`.

- [ ] **Step 8: Create `packages/core/src/authorization.ts`**

Rewrite without NextAuth dependency. The original imports `getServerAuthSession()` which is Next.js-specific. For the Express API, we just need the email check function:

```ts
const ALLOWED_EMAIL = "martinlucam@gmail.com"

export function isEmailAuthorized(email: string): boolean {
  return email === ALLOWED_EMAIL
}
```

- [ ] **Step 9: Create `packages/core/src/utils.ts`**

Extract only the shared functions from `lib/utils.ts` (NOT `cn` — that stays in `apps/web`):

```ts
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i] || ""}`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/* Get client IP from request headers.
   Works with both Web API Headers (Next.js) and Express IncomingHttpHeaders.
   In Express controllers, use req.ip or req.headers["x-forwarded-for"] directly instead. */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null
  }

  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  return null
}
```

- [ ] **Step 10: Create `packages/core/src/auth/types.ts`**

```ts
export interface JWTPayload {
  sub: string
  id: string
  email: string
  name: string
  iat: number
  exp: number
}

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
}
```

- [ ] **Step 11: Create `packages/core/src/auth/jwt.ts`**

```ts
import jwt from "jsonwebtoken"
import type { JWTPayload, AuthenticatedUser } from "./types"

export function verifyToken(token: string): AuthenticatedUser {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set")
  }

  const payload = jwt.verify(token, secret) as JWTPayload

  return {
    id: payload.id || payload.sub,
    email: payload.email,
    name: payload.name,
  }
}
```

- [ ] **Step 12: Copy `lib/types/api.ts` → `packages/core/src/types/api.ts`**

Copy verbatim — no imports.

- [ ] **Step 13: Create `packages/core/src/index.ts`**

```ts
export { requireEnv } from "./env"
export { Logger, logger } from "./logger"
export { encrypt, decrypt, getEncryptionPassword } from "./encryption"
export { getRedisClient, closeRedisConnection } from "./redis"
export {
  QUEUE_NAMES,
  getRedisConnectionOptions,
  getQueue,
  getMetricsQueue,
  getHealthChecksQueue,
  getBackupsQueue,
  getCleanupQueue,
  getNotificationsQueue,
  getServiceIntegrationsQueue,
  closeAllQueues,
} from "./queues"
export { isEmailAuthorized } from "./authorization"
export { verifyToken } from "./auth/jwt"
export type { JWTPayload, AuthenticatedUser } from "./auth/types"
export type { ApiResponse, ApiError, PaginatedResponse } from "./types/api"
export { formatBytes, formatPercent, getClientIp } from "./utils"
```

- [ ] **Step 14: Install and verify compilation**

```bash
cd ../.. && bun install
cd packages/core && bun tsc --noEmit
```

- [ ] **Step 15: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add shared infrastructure package"
```

---

## Task 4: `packages/engine` — Domain Logic

**Files:**
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/src/proxmox/service.ts` (from `lib/services/proxmox.ts`)
- Create: `packages/engine/src/proxmox/test.ts` (from `lib/proxmox-test.ts`)
- Create: `packages/engine/src/proxmox/types.ts` (from `lib/types/proxmox.ts`)
- Create: `packages/engine/src/audit/logger.ts` (from `lib/audit.ts`)
- Create: `packages/engine/src/services/connectivity.ts` (from `lib/service-test.ts`)
- Create: `packages/engine/src/services/types.ts` (from `lib/types/services.ts`)
- Create: `packages/engine/src/email/resend.ts` (from `lib/resend.ts`)
- Create: `packages/engine/src/email/templates/contact.tsx` (from `components/ContactEmailTemplate.tsx`)
- Create: `packages/engine/src/index.ts`

**Source references:**
- `lib/services/proxmox.ts` (190 lines) — update imports from `@/types/proxmox` to local `./types`
- `lib/proxmox-test.ts` (106 lines) — update import from `@/services/proxmox` to local `./service`
- `lib/types/proxmox.ts` (51 lines) — copy as-is
- `lib/audit.ts` (38 lines) — update imports to `@cnet/db`
- `lib/service-test.ts` (262 lines) — copy as-is (only imports `axios`)
- `lib/types/services.ts` (41 lines) — copy as-is
- `lib/resend.ts` (70 lines) — copy as-is (only imports `resend`)
- `components/ContactEmailTemplate.tsx` — copy, update if needed

- [ ] **Step 1: Create `packages/engine/package.json`**

```json
{
  "name": "@cnet/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@cnet/core": "workspace:*",
    "@cnet/db": "workspace:*",
    "axios": "^1.7.9",
    "react": "^19.2.3",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.8",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/engine/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Note: `jsx: react-jsx` is needed for the ContactEmailTemplate.

- [ ] **Step 3: Copy type files**

Copy `lib/types/proxmox.ts` → `packages/engine/src/proxmox/types.ts` (verbatim, no imports).

Copy `lib/types/services.ts` → `packages/engine/src/services/types.ts` (verbatim, no imports).

- [ ] **Step 4: Move ProxmoxService**

Copy `lib/services/proxmox.ts` → `packages/engine/src/proxmox/service.ts`.

Update the import:
```diff
-import type { ProxmoxNode, ProxmoxVM, NodeMetrics, StoragePool } from "@/types/proxmox"
+import type { ProxmoxNode, ProxmoxVM, NodeMetrics, StoragePool } from "./types"
```

- [ ] **Step 5: Move Proxmox test**

Copy `lib/proxmox-test.ts` → `packages/engine/src/proxmox/test.ts`.

Update the import:
```diff
-import { ProxmoxService } from "@/services/proxmox"
+import { ProxmoxService } from "./service"
```

- [ ] **Step 6: Move audit logger**

Copy `lib/audit.ts` → `packages/engine/src/audit/logger.ts`.

Update imports:
```diff
-import { db } from "@/db/client"
-import { auditLogs } from "@/db/schema"
-import type { auditActionEnum } from "@/db/schema"
+import { db } from "@cnet/db"
+import { auditLogs, auditActionEnum } from "@cnet/db/schema"
```

- [ ] **Step 7: Move service connectivity tests**

Copy `lib/service-test.ts` → `packages/engine/src/services/connectivity.ts` (verbatim — only imports `axios`).

- [ ] **Step 8: Move email**

Copy `lib/resend.ts` → `packages/engine/src/email/resend.ts` (verbatim — only imports `resend`).

Copy `components/ContactEmailTemplate.tsx` → `packages/engine/src/email/templates/contact.tsx`. Update any internal imports if present.

- [ ] **Step 9: Create `packages/engine/src/index.ts`**

```ts
export { ProxmoxService } from "./proxmox/service"
export { testProxmoxConnection, type ProxmoxConnectionTestResult } from "./proxmox/test"
export type { ProxmoxNode, ProxmoxVM, NodeMetrics, StoragePool } from "./proxmox/types"

export { logAuditAction, type LogAuditActionParams } from "./audit/logger"

export {
  testServiceConnection,
  testPiHoleConnection,
  testPlexConnection,
  testMinecraftConnection,
  testNASConnection,
  type ServiceTestResult,
} from "./services/connectivity"
export type {
  ServiceType,
  ServiceStatus,
  ServiceHealth,
  PiHoleStatus,
  PlexStatus,
  MinecraftStatus,
} from "./services/types"

export { getResendClient, sendEmail, type SendEmailOptions } from "./email/resend"
```

- [ ] **Step 10: Install and verify compilation**

```bash
cd ../.. && bun install
cd packages/engine && bun tsc --noEmit
```

- [ ] **Step 11: Commit**

```bash
git add packages/engine/
git commit -m "feat(engine): add domain logic package (proxmox, audit, services, email)"
```

---

## Task 5: `apps/api` — Express + TSOA Server

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsoa.json`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/preflight.ts`
- Create: `apps/api/src/middleware/auth.middleware.ts`
- Create: `apps/api/src/middleware/error.middleware.ts`
- Create: `apps/api/.gitignore`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@cnet/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "api:generate": "tsoa spec-and-routes",
    "build": "tsoa spec-and-routes && tsc",
    "dev": "bun run src/index.ts --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@cnet/core": "workspace:*",
    "@cnet/db": "workspace:*",
    "@cnet/engine": "workspace:*",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "tsoa": "^6.6.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/api/tsoa.json`**

```json
{
  "entryFile": "src/server.ts",
  "noImplicitAdditionalProperties": "throw-on-extras",
  "controllerPathGlobs": ["src/controllers/**/*.controller.ts"],
  "spec": {
    "outputDirectory": "src/generated",
    "specVersion": 3,
    "securityDefinitions": {
      "jwt": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  },
  "routes": {
    "routesDir": "src/generated",
    "authenticationModule": "src/middleware/auth.middleware"
  }
}
```

- [ ] **Step 4: Create `apps/api/src/middleware/auth.middleware.ts`**

This is the TSOA authentication handler. TSOA calls `expressAuthentication` for every `@Security("jwt")` route:

```ts
import type { Request } from "express"
import { verifyToken } from "@cnet/core"

export function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[]
): Promise<unknown> {
  if (securityName !== "jwt") {
    return Promise.reject(new Error(`Unknown security scheme: ${securityName}`))
  }

  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return Promise.reject(new Error("No Bearer token provided"))
  }

  const token = authHeader.slice(7)

  try {
    const user = verifyToken(token)
    return Promise.resolve(user)
  } catch {
    return Promise.reject(new Error("Invalid or expired token"))
  }
}
```

- [ ] **Step 5: Create `apps/api/src/middleware/error.middleware.ts`**

```ts
import type { Request, Response, NextFunction } from "express"
import { ValidateError } from "tsoa"

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ValidateError) {
    res.status(422).json({
      message: "Validation failed",
      details: err.fields,
    })
    return
  }

  if (err instanceof Error) {
    const status = err.message.includes("token") || err.message.includes("Unauthorized") ? 401 : 500
    res.status(status).json({
      message: err.message,
    })
    return
  }

  res.status(500).json({
    message: "Internal server error",
  })
}
```

- [ ] **Step 6: Create `apps/api/src/preflight.ts`**

```ts
import { Pool } from "pg"
import Redis from "ioredis"

export async function runPreflightChecks(): Promise<void> {
  // Check PostgreSQL
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    await pool.query("SELECT 1")
    await pool.end()
    console.log("✅ Database connected")
  } catch {
    console.warn("⚠ Database not reachable at DATABASE_URL — API will fail on DB queries")
  }

  // Check Redis
  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
    const redis = new Redis(redisUrl)
    await redis.ping()
    await redis.quit()
    console.log("✅ Redis connected")
  } catch {
    console.warn("⚠ Redis not reachable — job queues will not function")
  }
}
```

- [ ] **Step 7: Create `apps/api/src/server.ts`**

```ts
import express from "express"
import cors from "cors"
import { RegisterRoutes } from "./generated/routes"
import { errorHandler } from "./middleware/error.middleware"

export function createApp(): express.Express {
  const app = express()

  app.use(express.json())
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3001",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  )

  RegisterRoutes(app)

  app.use(errorHandler)

  return app
}
```

- [ ] **Step 8: Create `apps/api/src/index.ts`**

```ts
import "@cnet/core/env"
import { createApp } from "./server"
import { runPreflightChecks } from "./preflight"

const PORT = process.env.API_PORT || 4000

async function main() {
  await runPreflightChecks()

  const app = createApp()

  app.listen(PORT, () => {
    console.log(`🚀 C-Net API running on http://localhost:${PORT}`)
  })
}

main().catch(console.error)
```

- [ ] **Step 9: Create `apps/api/.gitignore`**

```
src/generated/
```

- [ ] **Step 10: Install dependencies**

```bash
cd ../.. && bun install
```

Note: Do NOT try to compile `apps/api` yet — `server.ts` imports `RegisterRoutes` from `./generated/routes` which doesn't exist until controllers are written and `tsoa spec-and-routes` is run (Task 7, Step 8). The API will compile after Task 7.

- [ ] **Step 11: Commit**

```bash
git add apps/api/
git commit -m "feat(api): scaffold Express + TSOA server with auth middleware"
```

---

## Task 6: NextAuth JWT Override

**Files:**
- Modify: `lib/auth.config.ts` (current location, will be moved in Task 9)

This is the critical auth change. Override NextAuth's default JWE encode/decode with standard signed JWTs so the Express API can verify tokens with `jsonwebtoken`.

- [ ] **Step 1: Install `jsonwebtoken` in web app dependencies**

Add to the current `package.json` (will move to `apps/web/package.json` later):
```bash
bun add jsonwebtoken @types/jsonwebtoken
```

- [ ] **Step 2: Modify `lib/auth.config.ts`**

Add the JWT override to the existing `authConfig`. The key addition is the `jwt` property:

```diff
+import jwt from "jsonwebtoken"
+import type { JWT } from "next-auth/jwt"

 export const authConfig: NextAuthConfig = {
   // ...existing config unchanged
+  jwt: {
+    encode({ token, secret }) {
+      return jwt.sign(token!, secret as string)
+    },
+    decode({ token, secret }) {
+      return jwt.verify(token!, secret as string) as JWT
+    },
+  },
   session: {
     strategy: "jwt",
     maxAge: 30 * 24 * 60 * 60,
   },
   // ...rest unchanged
 }
```

- [ ] **Step 3: Test locally**

Start the dev server and verify Google OAuth sign-in still works. Existing sessions will be invalidated (expected — users must re-sign-in once).

```bash
bun run dev
```

Navigate to the app, sign out, sign back in. Confirm the session works.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.config.ts package.json bun.lock
git commit -m "feat(auth): override NextAuth JWT to use standard signed tokens"
```

---

## Task 7: TSOA Controllers

**Files:**
- Create: `apps/api/src/controllers/health.controller.ts`
- Create: `apps/api/src/controllers/contact.controller.ts`
- Create: `apps/api/src/controllers/proxmox.controller.ts`
- Create: `apps/api/src/controllers/metrics.controller.ts`
- Create: `apps/api/src/controllers/infrastructure.controller.ts`
- Create: `apps/api/src/controllers/services.controller.ts`
- Create: `apps/api/src/controllers/jobs.controller.ts`

For each controller, translate the existing Next.js API route handler into a TSOA decorated controller method. The logic stays the same — only the framework wrapper changes.

**Source references:**
- `app/api/contact/route.ts` (78 lines) → `contact.controller.ts`
- `app/api/proxmox/nodes/route.ts` (47 lines) → `proxmox.controller.ts`
- `app/api/proxmox/vms/route.ts` (47 lines) → `proxmox.controller.ts`
- `app/api/proxmox/vms/[vmid]/start/route.ts` (76 lines) → `proxmox.controller.ts`
- `app/api/proxmox/vms/[vmid]/stop/route.ts` (76 lines) → `proxmox.controller.ts`
- `app/api/proxmox/vms/[vmid]/restart/route.ts` (76 lines) → `proxmox.controller.ts`
- `app/api/metrics/current/route.ts` (63 lines) → `metrics.controller.ts`
- `app/api/infrastructure/config/route.ts` (137 lines) → `infrastructure.controller.ts`
- `app/api/services/credentials/route.ts` (143 lines) → `services.controller.ts`
- `app/api/services/credentials/[id]/route.ts` (136 lines) → `services.controller.ts`
- `app/api/services/credentials/test/route.ts` (103 lines) → `services.controller.ts`
- `app/api/jobs/trigger/route.ts` (94 lines) → `jobs.controller.ts`
- `app/api/jobs/metrics/route.ts` (77 lines) → `jobs.controller.ts`
- `app/api/jobs/status/route.ts` (124 lines) → `jobs.controller.ts`

- [ ] **Step 1: Create `health.controller.ts`**

```ts
import { Controller, Get, Route } from "tsoa"

@Route("health")
export class HealthController extends Controller {
  @Get()
  async getHealth() {
    return { status: "ok", timestamp: new Date().toISOString() }
  }
}
```

- [ ] **Step 2: Create `contact.controller.ts`**

Translate `app/api/contact/route.ts`. This is a PUBLIC endpoint (no `@Security`):

```ts
import { Body, Controller, Post, Route } from "tsoa"
import { sendEmail } from "@cnet/engine"

interface ContactRequest {
  name: string
  email: string
  message: string
}

@Route("contact")
export class ContactController extends Controller {
  @Post()
  async sendContact(@Body() body: ContactRequest) {
    await sendEmail({
      to: "martinlucam@gmail.com",
      subject: `Contact from ${body.name}`,
      text: `From: ${body.name} (${body.email})\n\n${body.message}`,
    })
    return { success: true }
  }
}
```

Reference the existing contact route handler for the exact Resend email logic — adapt the template rendering approach.

- [ ] **Step 3: Create `proxmox.controller.ts`**

Translate the 5 Proxmox API routes. All require `@Security("jwt")`:

```ts
import { Controller, Get, Post, Route, Security, Path, Request } from "tsoa"
import { ProxmoxService, logAuditAction } from "@cnet/engine"
import { db } from "@cnet/db"
import { infrastructureConfigs } from "@cnet/db/schema"
import { eq } from "drizzle-orm"
import { decrypt, getEncryptionPassword } from "@cnet/core"
import type { Request as ExpressRequest } from "express"

@Route("proxmox")
@Security("jwt")
export class ProxmoxController extends Controller {
  private async getProxmoxService(userId: string): Promise<ProxmoxService> {
    const config = await db.query.infrastructureConfigs.findFirst({
      where: eq(infrastructureConfigs.userId, userId),
    })
    if (!config) {
      this.setStatus(404)
      throw new Error("No infrastructure configuration found")
    }
    const password = getEncryptionPassword()
    return new ProxmoxService(
      config.proxmoxHost,
      config.proxmoxUser,
      await decrypt(config.proxmoxToken, password)
    )
  }

  @Get("nodes")
  async getNodes(@Request() req: ExpressRequest) {
    const proxmox = await this.getProxmoxService(req.user.id)
    return proxmox.getNodes()
  }

  @Get("vms")
  async getVMs(@Request() req: ExpressRequest) {
    const proxmox = await this.getProxmoxService(req.user.id)
    return proxmox.getAllVMs()
  }

  @Post("vms/{vmid}/start")
  async startVM(@Path() vmid: string, @Request() req: ExpressRequest) {
    const proxmox = await this.getProxmoxService(req.user.id)
    const result = await proxmox.startVM(vmid)
    // Audit log — reference app/api/proxmox/vms/[vmid]/start/route.ts for exact logic
    return { success: true, data: result }
  }

  @Post("vms/{vmid}/stop")
  async stopVM(@Path() vmid: string, @Request() req: ExpressRequest) {
    const proxmox = await this.getProxmoxService(req.user.id)
    const result = await proxmox.stopVM(vmid)
    return { success: true, data: result }
  }

  @Post("vms/{vmid}/restart")
  async restartVM(@Path() vmid: string, @Request() req: ExpressRequest) {
    const proxmox = await this.getProxmoxService(req.user.id)
    const result = await proxmox.restartVM(vmid)
    return { success: true, data: result }
  }
}
```

For the start/stop/restart methods, include the audit logging logic from the existing route handlers (call `logAuditAction` from `@cnet/engine`). Reference the exact logic in `app/api/proxmox/vms/[vmid]/start/route.ts` (lines ~30-70).

- [ ] **Step 4: Create `metrics.controller.ts`**

Translate `app/api/metrics/current/route.ts`:

```ts
import { Controller, Get, Route, Security, Request } from "tsoa"
import type { Request as ExpressRequest } from "express"
// ... same pattern as ProxmoxController for getting the service

@Route("metrics")
@Security("jwt")
export class MetricsController extends Controller {
  @Get("current")
  async getCurrentMetrics(@Request() req: ExpressRequest) {
    // Translate logic from app/api/metrics/current/route.ts
    // Gets node status from Proxmox for each node
  }
}
```

- [ ] **Step 5: Create `infrastructure.controller.ts`**

Translate `app/api/infrastructure/config/route.ts` (GET + POST):

```ts
import { Body, Controller, Get, Post, Route, Security, Request } from "tsoa"
import type { Request as ExpressRequest } from "express"

interface InfrastructureConfigRequest {
  proxmoxHost: string
  proxmoxUser: string
  proxmoxToken: string
  proxmoxVerifySSL?: boolean
}

@Route("infrastructure")
@Security("jwt")
export class InfrastructureController extends Controller {
  @Get("config")
  async getConfig(@Request() req: ExpressRequest) {
    // Translate GET logic from app/api/infrastructure/config/route.ts
  }

  @Post("config")
  async saveConfig(@Body() body: InfrastructureConfigRequest, @Request() req: ExpressRequest) {
    // Translate POST logic — encrypt token, test connection, save to DB
  }
}
```

- [ ] **Step 6: Create `services.controller.ts`**

Translate the 4 service credentials routes (GET, POST, PATCH, DELETE, test):

```ts
import { Body, Controller, Delete, Get, Patch, Path, Post, Route, Security, Request } from "tsoa"
import type { Request as ExpressRequest } from "express"

@Route("services")
@Security("jwt")
export class ServicesController extends Controller {
  @Get("credentials")
  async listCredentials(@Request() req: ExpressRequest) { /* ... */ }

  @Post("credentials")
  async createCredential(@Body() body: CreateCredentialRequest, @Request() req: ExpressRequest) { /* ... */ }

  @Patch("credentials/{id}")
  async updateCredential(@Path() id: string, @Body() body: UpdateCredentialRequest, @Request() req: ExpressRequest) { /* ... */ }

  @Delete("credentials/{id}")
  async deleteCredential(@Path() id: string, @Request() req: ExpressRequest) { /* ... */ }

  @Post("credentials/test")
  async testCredential(@Body() body: TestCredentialRequest, @Request() req: ExpressRequest) { /* ... */ }
}
```

For each method, translate the exact logic from the corresponding API route handler. The Zod validation is replaced by TSOA's interface-based validation.

- [ ] **Step 7: Create `jobs.controller.ts`**

Translate the 3 jobs routes (trigger, metrics, status):

```ts
import { Body, Controller, Get, Post, Query, Route, Security, Request } from "tsoa"
import type { Request as ExpressRequest } from "express"
import { getQueue, QUEUE_NAMES } from "@cnet/core"

@Route("jobs")
@Security("jwt")
export class JobsController extends Controller {
  @Post("trigger")
  async triggerJob(@Body() body: TriggerJobRequest) { /* ... */ }

  @Get("metrics")
  async getMetrics() { /* ... */ }

  @Get("status")
  async getStatus(@Query() queue?: string, @Query() jobId?: string) { /* ... */ }
}
```

- [ ] **Step 8: Generate TSOA routes and spec**

```bash
cd apps/api && bun run api:generate
```

This creates `src/generated/routes.ts` and `src/generated/swagger.json`. Verify both files exist.

- [ ] **Step 9: Verify the API compiles and starts**

```bash
cd apps/api && bun tsc --noEmit
cd apps/api && bun run dev
```

Test the health endpoint:
```bash
curl http://localhost:4000/health
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/controllers/
git commit -m "feat(api): add all TSOA controllers (proxmox, metrics, infrastructure, services, jobs, contact, health)"
```

---

## Task 8: `packages/api-client` — Orval Codegen

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/orval.config.ts`
- Create: `packages/api-client/src/index.ts`

- [ ] **Step 1: Create `packages/api-client/package.json`**

```json
{
  "name": "@cnet/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "codegen": "orval",
    "build": "tsc"
  },
  "dependencies": {},
  "devDependencies": {
    "orval": "^7.6.0",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/api-client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/api-client/orval.config.ts`**

```ts
import { defineConfig } from "orval"

export default defineConfig({
  cnet: {
    input: {
      target: "../apps/api/src/generated/swagger.json",
    },
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
      mode: "single",
      baseUrl: "process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'",
    },
  },
})
```

Note: Check orval docs for the correct `baseUrl` configuration syntax — it may need to be a string literal or use a different approach for runtime configuration.

- [ ] **Step 4: Create `packages/api-client/src/index.ts`**

```ts
export * from "./generated/api"
```

- [ ] **Step 5: Create `packages/api-client/.gitignore`**

```
src/generated/
```

- [ ] **Step 6: Generate the client**

First, ensure the API's swagger.json exists:
```bash
cd apps/api && bun run api:generate
```

Then run orval:
```bash
cd ../../packages/api-client && bun run codegen
```

Verify `src/generated/api.ts` was created.

- [ ] **Step 7: Commit**

```bash
git add packages/api-client/
git commit -m "feat(api-client): add orval-generated typed API client"
```

---

## Task 9: `apps/web` — Migrate Next.js Frontend

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Move: All frontend files from root into `apps/web/`
- Modify: `lib/auth.config.ts` — update `@/db/client` import to `@cnet/db`
- Modify: `lib/utils.ts` — keep only `cn()`
- Delete: All `app/api/*` route handlers EXCEPT `app/api/auth/[...nextauth]/route.ts`
- Delete: `lib/db/`, `lib/encryption.ts`, `lib/redis.ts`, `lib/queues.ts`, etc.
- Add: API client wrapper with JWT header injection

This is the largest task. It's mostly moving files and updating imports.

- [ ] **Step 1: Create `apps/web/package.json`**

Move the current dependencies (minus the ones that moved to packages) into `apps/web/package.json`:

```json
{
  "name": "@cnet/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "dependencies": {
    "@cnet/api-client": "workspace:*",
    "@cnet/db": "workspace:*",
    "@auth/drizzle-adapter": "^latest",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.3",
    "@radix-ui/themes": "^3.3.0",
    "@tailwindcss/postcss": "^4.1.18",
    "@tanstack/react-query": "^5.59.0",
    "@vercel/speed-insights": "^1.3.1",
    "animejs": "^4.3.5",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "jsonwebtoken": "^9.0.2",
    "next": "^16.1.1",
    "next-auth": "^5.0.0-beta.25",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "react-icons": "^5.5.0",
    "tailwind-merge": "^2.5.4",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@chromatic-com/storybook": "^5.0.0",
    "@commitlint/cli": "^20.4.0",
    "@commitlint/config-conventional": "^20.4.0",
    "@storybook/addon-a11y": "^10.2.3",
    "@storybook/addon-docs": "^10.2.3",
    "@storybook/addon-onboarding": "^10.2.3",
    "@storybook/addon-vitest": "^10.2.3",
    "@storybook/nextjs-vite": "^10.2.3",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitest/browser-playwright": "^4.0.18",
    "@vitest/coverage-v8": "^4.0.18",
    "autoprefixer": "^10.4.20",
    "husky": "^9.1.7",
    "playwright": "^1.58.1",
    "postcss": "^8.4.47",
    "storybook": "^10.2.3",
    "tailwindcss": "^4.1.2",
    "typescript": "^5.9.2",
    "vite": "^7.3.1",
    "vitest": "^4.0.18"
  }
}
```

Note: `@cnet/db` is needed because NextAuth's `DrizzleAdapter` imports the db client and schema. `@cnet/api-client` is the typed API client.

- [ ] **Step 2: Move frontend files into `apps/web/`**

```bash
# Move the Next.js app and supporting files
mv app/ apps/web/app/
mv components/ apps/web/components/
mv public/ apps/web/public/
mv stories/ apps/web/stories/
mv .storybook/ apps/web/.storybook/
mv next.config.js apps/web/
mv tailwind.config.ts apps/web/
mv postcss.config.mjs apps/web/
mv middleware.ts apps/web/ 2>/dev/null  # if it exists

# Move lib files that STAY in web
mkdir -p apps/web/lib/stores
cp lib/auth.ts apps/web/lib/auth.ts
cp lib/auth.config.ts apps/web/lib/auth.config.ts
cp lib/stores/auth-modal.ts apps/web/lib/stores/auth-modal.ts
cp lib/proxy.ts apps/web/lib/proxy.ts 2>/dev/null  # Next.js middleware proxy (if still needed)
```

- [ ] **Step 3: Create `apps/web/lib/utils.ts`** (cn only)

```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Update `apps/web/lib/auth.config.ts`**

Update the db import to use the package:
```diff
-import { db } from "@/db/client"
+import { db } from "@cnet/db"
```

Keep the JWT override from Task 6. Everything else stays the same.

- [ ] **Step 5: Update `apps/web/lib/auth.ts`**

Update the import:
```diff
-import { auth } from "@/lib/auth.config"
+import { auth } from "./auth.config"
```

Keep the `getServerAuthSession` and `requireAuth` functions as-is (they're used by the NextAuth route handler).

- [ ] **Step 6: Update `apps/web/next.config.js` for monorepo**

Add `transpilePackages` so Next.js can compile workspace packages:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ["@cnet/db", "@cnet/api-client"],
}

export default nextConfig
```

- [ ] **Step 7: Delete moved/obsolete files from `apps/web/`**

Delete the API route handlers (except NextAuth):
```bash
rm -rf apps/web/app/api/proxmox
rm -rf apps/web/app/api/metrics
rm -rf apps/web/app/api/infrastructure
rm -rf apps/web/app/api/services
rm -rf apps/web/app/api/jobs
rm -rf apps/web/app/api/contact
```

Keep only `apps/web/app/api/auth/[...nextauth]/route.ts`.

- [ ] **Step 8: Create `apps/web/lib/api.ts`** — API client wrapper with JWT injection

```ts
import { getSession } from "next-auth/react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await getSession()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || "API request failed")
  }

  return response.json()
}
```

Note: The exact mechanism for getting the JWT token client-side depends on how NextAuth exposes it. The `session.accessToken` may need to be configured in the NextAuth JWT callback. Reference the existing `auth.config.ts` callbacks and adjust accordingly. The orval-generated client may also need a custom fetch wrapper — check orval docs for the `mutator` option.

- [ ] **Step 9: Update frontend component imports**

Search for any component that imports from `lib/services/*`, `lib/db/*`, `lib/encryption.ts`, etc. and replace with calls to the generated API client. These imports no longer exist — the frontend talks to the API server now.

Use grep to find all affected imports:
```bash
grep -rl "@/lib/services\|@/db\|@/lib/encryption\|@/lib/queues\|@/lib/redis\|@/lib/audit" apps/web/
```

For each file found, replace the direct DB/service import with an API client call.

- [ ] **Step 10: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 11: Verify web builds**

```bash
cd ../.. && bun install
cd apps/web && bun next build
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/
git commit -m "feat(web): migrate Next.js frontend to monorepo workspace"
```

---

## Task 10: `apps/workers` — Migrate Workers

**Files:**
- Create: `apps/workers/package.json`
- Create: `apps/workers/tsconfig.json`
- Move: `lib/workers/*.ts` → `apps/workers/src/workers/`
- Move: `lib/scripts/start-workers.ts` → `apps/workers/src/worker.ts`
- Create: `apps/workers/src/index.ts`

- [ ] **Step 1: Create `apps/workers/package.json`**

```json
{
  "name": "@cnet/workers",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run src/worker.ts --watch",
    "build": "tsc",
    "start": "node dist/worker.js"
  },
  "dependencies": {
    "@cnet/core": "workspace:*",
    "@cnet/db": "workspace:*",
    "@cnet/engine": "workspace:*",
    "bullmq": "^5.66.5"
  },
  "devDependencies": {
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: Create `apps/workers/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Copy worker files**

```bash
cp lib/workers/metrics-collector.ts apps/workers/src/workers/
cp lib/workers/health-checker.ts apps/workers/src/workers/
cp lib/workers/backup-runner.ts apps/workers/src/workers/
cp lib/workers/cleanup.ts apps/workers/src/workers/
cp lib/workers/notification-sender.ts apps/workers/src/workers/
cp lib/workers/service-integrations.ts apps/workers/src/workers/
```

- [ ] **Step 4: Update imports in each worker file**

For every worker file, update the imports:
```diff
-import { getRedisConnectionOptions, QUEUE_NAMES } from "@/lib/queues"
-import { db } from "@/db/client"
-import { metricsSnapshots, infrastructureConfigs } from "@/db/schema"
-import { ProxmoxService } from "@/services/proxmox"
-import { decrypt, getEncryptionPassword } from "@/lib/encryption"
-import { logAuditAction } from "@/lib/audit"
-import { sendEmail } from "@/lib/resend"
+import { getRedisConnectionOptions, QUEUE_NAMES, decrypt, getEncryptionPassword } from "@cnet/core"
+import { db } from "@cnet/db"
+import { metricsSnapshots, infrastructureConfigs } from "@cnet/db/schema"
+import { ProxmoxService, logAuditAction, sendEmail } from "@cnet/engine"
```

Adjust per file based on what each worker actually imports. Use grep to find all `@/` imports in each file and remap them.

- [ ] **Step 5: Create `apps/workers/src/index.ts`**

Adapt from `lib/workers/index.ts` — update imports to the workers in `./workers/` directory and to `@cnet/core` for queues:

```diff
-import { getMetricsQueue, getHealthChecksQueue, ... } from "@/lib/queues"
-import { createMetricsCollectorWorker } from "./metrics-collector"
+import { getMetricsQueue, getHealthChecksQueue, ... } from "@cnet/core"
+import { createMetricsCollectorWorker } from "./workers/metrics-collector"
```

Keep the `initializeWorkers()` and `shutdownWorkers()` functions unchanged in logic.

- [ ] **Step 6: Create `apps/workers/src/worker.ts`**

Adapt from `lib/scripts/start-workers.ts`:

```ts
import "@cnet/core/env"
import { initializeWorkers, shutdownWorkers } from "./index"

async function main() {
  console.log("🔧 Starting C-Net workers...")
  await initializeWorkers()
  console.log("✅ Workers initialized")
}

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...")
  await shutdownWorkers()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("Shutting down workers...")
  await shutdownWorkers()
  process.exit(0)
})

main().catch((err) => {
  console.error("Worker startup failed:", err)
  process.exit(1)
})
```

- [ ] **Step 7: Verify compilation**

```bash
cd apps/workers && bun tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/workers/
git commit -m "feat(workers): migrate BullMQ workers to monorepo workspace"
```

---

## Task 11: Cleanup — Remove Old Files

**Files:**
- Delete: `lib/` directory (everything has been moved)
- Delete: Root-level `drizzle.config.ts`
- Delete: `app/` directory from root (moved to `apps/web/app/`)
- Delete: `components/` from root (moved to `apps/web/components/`)
- Delete: `public/`, `stories/`, `.storybook/` from root
- Delete: Root `next.config.js`, `tailwind.config.ts`, `postcss.config.mjs`
- Update: Root `.gitignore`
- Update: `.env` stays at root (shared)

- [ ] **Step 1: Delete old `lib/` directory**

```bash
rm -rf lib/
```

- [ ] **Step 2: Delete old root-level frontend files**

```bash
rm -rf app/ components/ public/ stories/ .storybook/
rm -f next.config.js tailwind.config.ts postcss.config.mjs drizzle.config.ts middleware.ts
```

Only delete these if they've been successfully moved to `apps/web/` in Task 9. Verify with `ls apps/web/` first.

- [ ] **Step 3: Drop unused `redis` package**

The `redis` (v5.8.2) package is unused — the codebase uses `ioredis`. It's already not in any workspace `package.json` since we only added `ioredis` to `@cnet/core`.

- [ ] **Step 4: Drop `zod` from API dependencies**

Zod was used for request validation in Next.js API routes. TSOA handles validation now. Zod is no longer needed in `@cnet/api`. (If any package still uses Zod, keep it there.)

- [ ] **Step 5: Install all dependencies**

```bash
bun install
```

This installs all workspace dependencies and links the `@cnet/*` packages.

- [ ] **Step 6: Run full build**

```bash
turbo build
```

Fix any compilation errors. Expected order: `@cnet/db` → `@cnet/core` → `@cnet/engine` → `@cnet/api` (generate + build) → `@cnet/api-client` (codegen) → `@cnet/web` → `@cnet/workers`.

- [ ] **Step 7: Run lint and format**

```bash
bun run lint
bun run format
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove old monolith files, install workspace dependencies"
```

---

## Task 12: CI and Docker

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docker-compose.yml`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/workers/Dockerfile`

- [ ] **Step 1: Update CI workflow**

The existing CI has 6 jobs: `bugcat`, `commitlint`, `format`, `lint`, `type-check`, `build`, `sonarqube`. Update each:

- **bugcat**: Update path from `public/images/bugcat asleep.gif` to `apps/web/public/images/bugcat asleep.gif`
- **commitlint**: No change needed (operates on git commits, not file structure)
- **format**: Change `bun run format` to `bun run lint` (root script now uses `biome check .` at root level)
- **lint**: Change `bun run lint:check` to `bun run lint:check` (root script updated)
- **type-check**: Change `bun run type-check` to `bunx turbo build` (type checking happens during build in monorepo)
- **build**: Change `bun run build` to `bunx turbo build`, keep the env vars
- **sonarqube**: No change needed

- [ ] **Step 2: Create `docker-compose.yml`**

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
    environment:
      POSTGRES_DB: cnet
      POSTGRES_USER: cnet
      POSTGRES_PASSWORD: cnet

  redis:
    image: redis:7-alpine
    volumes: ["redis_data:/data"]

volumes:
  pg_data:
  redis_data:
```

- [ ] **Step 3: Create `apps/api/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bunx turbo prune @cnet/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bunx turbo build --filter=@cnet/api

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/ .
EXPOSE 4000
CMD ["bun", "run", "apps/api/dist/index.js"]
```

- [ ] **Step 4: Create `apps/web/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bunx turbo prune @cnet/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bunx turbo build --filter=@cnet/web

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/ .
EXPOSE 3001
CMD ["bun", "run", "apps/web/node_modules/.bin/next", "start", "-p", "3001"]
```

- [ ] **Step 5: Create `apps/workers/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bunx turbo prune @cnet/workers --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .
RUN bunx turbo build --filter=@cnet/workers

FROM base AS runner
WORKDIR /app
COPY --from=installer /app/ .
CMD ["bun", "run", "apps/workers/dist/worker.js"]
```

- [ ] **Step 6: Verify full dev experience**

```bash
turbo dev
```

This should start all three apps in parallel. Verify:
- `http://localhost:3001` — Next.js frontend loads
- `http://localhost:4000/health` — API returns `{"status":"ok"}`
- Workers log startup messages in the terminal

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml apps/*/Dockerfile .github/
git commit -m "feat: add Docker Compose, Dockerfiles, and update CI for monorepo"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Run the full build from clean state**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
bun install
turbo build
```

All packages and apps should build successfully.

- [ ] **Step 2: Test auth flow**

Start `turbo dev`, navigate to `http://localhost:3001`, sign in with Google. Verify the session is created and the frontend can call the Express API at `:4000` with the JWT.

- [ ] **Step 3: Test API endpoints**

With a valid JWT from step 2, test key endpoints:
```bash
TOKEN="<jwt from browser>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/proxmox/nodes
curl http://localhost:4000/health
curl -X POST http://localhost:4000/contact -H "Content-Type: application/json" -d '{"name":"test","email":"test@test.com","message":"hello"}'
```

- [ ] **Step 4: Test workers**

Verify workers start and can process jobs:
```bash
turbo dev --filter=@cnet/workers
```

Workers should log "Workers initialized" and begin processing scheduled jobs (metrics collection, health checks).

- [ ] **Step 5: Run lint**

```bash
bun run lint
bun run format
```

- [ ] **Step 6: Final commit**

If any fixes were needed during verification:
```bash
git add -A
git commit -m "fix: resolve integration issues from monorepo migration"
```
