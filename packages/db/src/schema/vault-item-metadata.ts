import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"
import { vaultDirectories } from "./vault-directories"
import { vaultFiles } from "./vault-files"

// One row per (user, item). Exactly one of fileId/dirId is set.
export const vaultItemMetadata = pgTable(
  "vault_item_metadata",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => vaultFiles.id, { onDelete: "cascade" }),
    dirId: uuid("dir_id").references(() => vaultDirectories.id, { onDelete: "cascade" }),
    starredAt: timestamp("starred_at"),
    color: text("color"),
  },
  (t) => ({
    fileMetaIdx: index("vault_meta_file_idx").on(t.userId, t.fileId),
    dirMetaIdx: index("vault_meta_dir_idx").on(t.userId, t.dirId),
  })
)
