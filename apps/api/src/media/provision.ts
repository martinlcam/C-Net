import { decrypt, encrypt, getEncryptionPassword } from "@cnet/core"
import { db } from "@cnet/db"
import { jellyfinUsers } from "@cnet/db/schema"
import { eq } from "drizzle-orm"
import type { VaultActor } from "../vault/access"
import { getJellyfin } from "./clients"

/**
 * Look up (or lazily provision) the Jellyfin account for the calling C-Net user.
 * Shared by the movie and TV controllers. Creates a passwordless Jellyfin user
 * on first access, mints a per-user token, and stores it encrypted.
 */
export async function resolveJellyfinUser(
  actor: VaultActor
): Promise<{ jellyfinUserId: string; token: string }> {
  const jf = getJellyfin()
  const existing = await db.query.jellyfinUsers.findFirst({
    where: eq(jellyfinUsers.userId, actor.id),
  })
  if (existing) {
    const token = await decrypt(existing.accessToken, getEncryptionPassword())
    return { jellyfinUserId: existing.jellyfinUserId, token }
  }
  const name = actor.email.replace(/[^A-Za-z0-9._@+-]/g, "_")
  const found = await jf.findUserByName(name)
  if (!found) await jf.createUser(name)
  const auth = await jf.authenticate(name)
  const encrypted = await encrypt(auth.AccessToken, getEncryptionPassword())
  await db
    .insert(jellyfinUsers)
    .values({ userId: actor.id, jellyfinUserId: auth.User.Id, accessToken: encrypted })
    .onConflictDoNothing()
  return { jellyfinUserId: auth.User.Id, token: auth.AccessToken }
}
