import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@cnet/db"
import { users, accounts, sessions, verificationTokens } from "@cnet/db/schema"
import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"
import type { NextAuthConfig, Session } from "next-auth"
import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"
import Google from "next-auth/providers/google"

/* Auth.js v5 reads AUTH_SECRET; we also accept legacy NEXTAUTH_SECRET. */
function authSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
}

// Validate required environment variables at runtime (not during build)
function validateEnv() {
  if (typeof window === "undefined" && !authSecret()) {
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
      // Email whitelist - only allow martinlucam@gmail.com
      const allowedEmail = "martinlucam@gmail.com"
      const userEmail = user.email || profile?.email || account?.email

      if (userEmail !== allowedEmail) {
        console.warn(`Unauthorized sign-in attempt from: ${userEmail}`)
        return false
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  jwt: {
    encode({ token, secret }) {
      return jwt.sign(token!, secret as string)
    },
    decode({ token, secret }) {
      return jwt.verify(token!, secret as string) as JWT
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: authSecret(),
}

const nextAuth = NextAuth(authConfig)

export const auth: (...args: [NextRequest] | []) => Promise<Session | null> = nextAuth.auth

export const handlers: {
  GET: (request: NextRequest) => Promise<Response>
  POST: (request: NextRequest) => Promise<Response>
} = nextAuth.handlers
