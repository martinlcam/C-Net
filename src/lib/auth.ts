import { auth } from '@/auth.config'

export async function getServerAuthSession() {
  return await auth()
}

export async function requireAuth() {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  // At this point, we know session.user.id exists, but TypeScript doesn't
  // So we use type guard to ensure TypeScript understands
  const userId = session.user.id
  if (!userId) {
    throw new Error('Unauthorized')
  }
  return {
    ...session,
    user: {
      ...session.user,
      id: userId,
    },
  }
}
