import { decrypt, encrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { jellyfinUsers } from "@cnet/db/schema"
import { eq } from "drizzle-orm"
import type { VaultActor } from "../vault/access"
import { getJellyfin } from "./clients"

/**
 * Stable, per-user Jellyfin device id. Must be unique per C-Net user — Jellyfin
 * keys access tokens by (Client, Device), so sharing a device id across users
 * makes each new login revoke the previous user's token. See JellyfinService.authenticate.
 */
function deviceIdFor(actor: VaultActor): string {
  return `cnet-${actor.id}`
}

/** True for an axios error whose response is HTTP 401 (revoked/expired token). */
function isUnauthorized(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 401
}

/**
 * Look up (or lazily provision) the Jellyfin account for the calling C-Net user.
 * Shared by the movie and TV controllers. Creates a passwordless Jellyfin user
 * on first access, mints a per-user token, and stores it encrypted.
 */
export async function resolveJellyfinUser(
  actor: VaultActor
): Promise<{ jellyfinUserId: string; token: string }> {
  const existing = await db.query.jellyfinUsers.findFirst({
    where: eq(jellyfinUsers.userId, actor.id),
  })
  if (existing) {
    const token = await decrypt(existing.accessToken, getEncryptionPassword())
    return { jellyfinUserId: existing.jellyfinUserId, token }
  }
  const jf = getJellyfin()
  const name = actor.email.replace(/[^A-Za-z0-9._@+-]/g, "_")
  const found = await jf.findUserByName(name)
  if (!found) await jf.createUser(name)
  const auth = await jf.authenticate(name, deviceIdFor(actor))
  const encrypted = await encrypt(auth.AccessToken, getEncryptionPassword())
  await db
    .insert(jellyfinUsers)
    .values({ userId: actor.id, jellyfinUserId: auth.User.Id, accessToken: encrypted })
    .onConflictDoNothing()
  return { jellyfinUserId: auth.User.Id, token: auth.AccessToken }
}

/**
 * Force a fresh per-user token (the existing one was revoked) and persist it.
 * Re-uses the user's stable device id so the new token survives other users' logins.
 */
export async function reauthJellyfinUser(actor: VaultActor): Promise<string> {
  const jf = getJellyfin()
  const name = actor.email.replace(/[^A-Za-z0-9._@+-]/g, "_")
  const auth = await jf.authenticate(name, deviceIdFor(actor))
  const encrypted = await encrypt(auth.AccessToken, getEncryptionPassword())
  await db
    .update(jellyfinUsers)
    .set({ accessToken: encrypted, jellyfinUserId: auth.User.Id })
    .where(eq(jellyfinUsers.userId, actor.id))
  return auth.AccessToken
}

/**
 * Run a Jellyfin call that uses the caller's per-user token, transparently
 * re-minting the token and retrying once if Jellyfin rejects it with a 401.
 * Use this for playback-state writes (progress/stopped) so a stale token never
 * silently drops watch history.
 */
export async function withJellyfinToken<T>(
  actor: VaultActor,
  fn: (token: string) => Promise<T>
): Promise<T> {
  const { token } = await resolveJellyfinUser(actor)
  try {
    return await fn(token)
  } catch (err) {
    if (!isUnauthorized(err)) throw err
    return fn(await reauthJellyfinUser(actor))
  }
}
