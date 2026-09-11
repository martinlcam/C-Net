import { currentAllowlist } from "@cnet/core/access/allowlist"
import type { Session } from "next-auth"

/*
 * `bun run dev:raw` — frontend-only dev with no repo-root .env, Postgres, Redis or API.
 *
 * Auth is replaced with a fake super-user session so every /cnet route renders instead of
 * bouncing to /auth/signin. Anything that talks to the API or realtime server still fails
 * and shows its normal error/empty state. The flag is server-only and never honored in
 * production, so a stray CNET_RAW on a prod host cannot open the dashboard.
 */
export const RAW_MODE = process.env.CNET_RAW === "1" && process.env.NODE_ENV !== "production"

const RAW_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export function rawSession(): Session {
  // Pick a real super entry so requireAuthorizedEmail()'s allowlist check still passes.
  const superEmail = currentAllowlist().find((e) => e.role === "super")?.email ?? "raw@localhost"
  return {
    user: { id: "raw-dev-user", name: "Raw Dev", email: superEmail, role: "super" },
    expires: new Date(Date.now() + RAW_SESSION_TTL_MS).toISOString(),
  }
}
