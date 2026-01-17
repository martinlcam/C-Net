import type { NextAuthConfig } from 'next-auth'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/db/client'

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    'Missing NEXTAUTH_SECRET environment variable. Please add it to your .env file.\n' +
      'You can generate one by running: openssl rand -base64 32\n' +
      'Or use: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
  )
}

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

const authInstance = NextAuth(authConfig)

export const { auth, handlers } = authInstance
