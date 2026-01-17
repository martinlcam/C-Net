import { getServerAuthSession } from './auth'

const ALLOWED_EMAIL = 'martinlucam@gmail.com'

/**
 * Requires the user to be authenticated and have an authorized email address.
 * Throws an error if the user is not authorized.
 */
export async function requireAuthorizedEmail() {
  const session = await getServerAuthSession()

  if (!session?.user?.email) {
    throw new Error('Unauthorized: No session or email found')
  }

  if (session.user.email !== ALLOWED_EMAIL) {
    throw new Error(`Unauthorized: Email ${session.user.email} is not authorized`)
  }

  return session
}

/**
 * Checks if the current user's email is authorized.
 * Returns true if authorized, false otherwise.
 */
export async function isAuthorizedEmail(): Promise<boolean> {
  try {
    await requireAuthorizedEmail()
    return true
  } catch {
    return false
  }
}
