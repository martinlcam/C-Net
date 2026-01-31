import type { NextAuthConfig, Session } from 'next-auth'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/db/client'
import type { NextRequest } from 'next/server'

// Validate required environment variables at runtime (not during build)
function validateEnv() {
  if (typeof window === 'undefined' && !process.env.NEXTAUTH_SECRET) {
    // Only throw in production, not during build
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE?.includes('build')) {
      throw new Error(
        'Missing NEXTAUTH_SECRET environment variable. Please add it to your .env file.\n' +
          'You can generate one by running: openssl rand -base64 32\n' +
          'Or use: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
      )
    }
  }
}
validateEnv()

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID || '',
      clientSecret: process.env.GOOGLE_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Email whitelist - only allow martinlucam@gmail.com
      const allowedEmail = 'martinlucam@gmail.com'
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
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const nextAuth = NextAuth(authConfig)

export const auth: (
  ...args: [NextRequest] | []
) => Promise<Session | null> = nextAuth.auth

export const handlers: {
  GET: (request: NextRequest) => Promise<Response>
  POST: (request: NextRequest) => Promise<Response>
} = nextAuth.handlers
