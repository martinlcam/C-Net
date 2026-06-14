import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"
import { vaultDirectories } from "./vault-directories"

export const vaultFiles = pgTable(
  "vault_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    directoryId: uuid("directory_id").references(() => vaultDirectories.id, {
      onDelete: "cascade",
    }),
    filename: text("filename").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    thumbKey: text("thumb_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    originalDirectoryId: uuid("original_directory_id"),
  },
  (t) => ({
    ownerCreatedIdx: index("vault_file_owner_created_idx").on(t.ownerUserId, t.createdAt),
    directoryIdx: index("vault_file_directory_idx").on(t.directoryId),
    deletedIdx: index("vault_file_deleted_idx").on(t.deletedAt),
  })
)
