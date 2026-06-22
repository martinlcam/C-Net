import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

/**
 * Maps a C-Net user to their auto-provisioned Jellyfin account. One row per
 * C-Net user (created lazily on first Media-tab access). `accessToken` is the
 * per-user Jellyfin token, encrypted at rest via @cnet/core encrypt/decrypt.
 */
export const jellyfinUsers = pgTable("jellyfin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  jellyfinUserId: text("jellyfin_user_id").notNull(),
  accessToken: text("access_token").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
