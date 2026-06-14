import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const vaultDirectories = pgTable(
  "vault_directories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    path: text("path").notNull(), // excludes userId, e.g. "notes/lorem"
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => vaultDirectories.id, {
      onDelete: "cascade",
    }),
    parentPath: text("parent_path"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    originalParentId: uuid("original_parent_id"),
    originalPath: text("original_path"),
  },
  (t) => ({
    ownerIdx: index("vault_dir_owner_idx").on(t.ownerUserId),
    parentIdx: index("vault_dir_parent_idx").on(t.parentId),
    parentPathIdx: index("vault_dir_parent_path_idx").on(t.parentPath),
    deletedIdx: index("vault_dir_deleted_idx").on(t.deletedAt),
  })
)
