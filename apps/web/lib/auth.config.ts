import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { getAllowlistEntry, isEmailAuthorized, type VaultRole } from "@cnet/core/access/allowlist"
import { db } from "@cnet/db"
import { accounts, sessions, users, verificationTokens } from "@cnet/db/schema"
import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"
import type { NextAuthConfig, NextAuthResult, Session } from "next-auth"
import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import Google from "next-auth/providers/google"
import { RAW_MODE, rawSession } from "./raw-mode"

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

/* Auth.js v5 reads AUTH_SECRET; we also accept legacy NEXTAUTH_SECRET. */
function authSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
}

// Auth.js throws MissingSecret (500 on /api/auth/*) without one; raw mode never signs a real
// session, so any fixed string keeps the handlers alive.
const RAW_SECRET = "cnet-raw-dev-secret"

// Validate required environment variables at runtime (not during build)
function validateEnv() {
  if (globalThis.window === undefined && !authSecret()) {
    // Only throw in production, not during build
    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE?.includes("build")) {
      throw new Error(
        "Missing AUTH_SECRET or NEXTAUTH_SECRET. Add one to your repo-root .env file.\n" +
          "Generate: openssl rand -base64 32"
      )
    }
  }
}
validateEnv()

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allowlist gate (VAULT_ALLOWLIST): super + storage users may sign in.
      const userEmail = user.email || profile?.email || account?.email

      if (typeof userEmail !== "string" || !isEmailAuthorized(userEmail)) {
        console.warn(`Unauthorized sign-in attempt from: ${userEmail}`)
        return false
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      // Resolve role live from the allowlist (source of truth) on each refresh.
      const rawEmail = user?.email ?? token.email
      const email = typeof rawEmail === "string" ? rawEmail : undefined
      token.role = (email ? getAllowlistEntry(email)?.role : undefined) ?? "storage"
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as VaultRole) ?? "storage"
      }
      return session
    },
  },
  jwt: {
    encode({ token, secret, maxAge }) {
      const key = Array.isArray(secret) ? secret[0] : secret
      // Auth.js stamps exp/iat only inside the default (jose) encoder we're replacing here, so
      // without expiresIn the session JWT would verify forever. Drop any registered claims a
      // decode/re-encode refresh carried over — jsonwebtoken rejects a payload that already has
      // `exp`, and a stale `iat` would anchor the new expiry to the original issue time.
      // biome-ignore lint/style/noNonNullAssertion: NextAuth guarantees token is set during encode
      const { exp: _exp, iat: _iat, jti: _jti, ...claims } = token!
      return jwt.sign(claims, key, { expiresIn: maxAge ?? SESSION_MAX_AGE_SECONDS })
    },
    decode({ token, secret }) {
      const key = Array.isArray(secret) ? secret[0] : secret
      // biome-ignore lint/style/noNonNullAssertion: NextAuth guarantees token is set during decode
      return jwt.verify(token!, key) as JWT
    },
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  secret: authSecret() ?? (RAW_MODE ? RAW_SECRET : undefined),
}

const nextAuth = NextAuth(authConfig)

export const auth: (...args: [NextRequest] | []) => Promise<Session | null> = RAW_MODE
  ? async () => rawSession()
  : nextAuth.auth

// Full-typed wrapper for Next.js proxy/middleware (supports the `auth((req) => ...)` overload).
export const authMiddleware: NextAuthResult["auth"] = nextAuth.auth

type AuthHandlers = {
  GET: (request: NextRequest) => Promise<Response>
  POST: (request: NextRequest) => Promise<Response>
}

// useSession()/getSession() read /api/auth/session, so raw mode must answer there too or
// client components would render signed-out while server components see the stub.
const rawHandlers: AuthHandlers = {
  GET: (request) =>
    request.nextUrl.pathname.endsWith("/session")
      ? Promise.resolve(Response.json(rawSession()))
      : nextAuth.handlers.GET(request),
  POST: nextAuth.handlers.POST,
}

export const handlers: AuthHandlers = RAW_MODE ? rawHandlers : nextAuth.handlers
