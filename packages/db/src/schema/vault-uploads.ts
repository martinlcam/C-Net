import { sql } from "drizzle-orm"
import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const vaultUploads = pgTable(
  "vault_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    directoryId: uuid("directory_id"),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    expectedSize: bigint("expected_size", { mode: "number" }).notNull(),
    chunkSize: bigint("chunk_size", { mode: "number" }).notNull(),
    chunkCount: integer("chunk_count").notNull(),
    uploadedBytes: bigint("uploaded_bytes", { mode: "number" }).notNull().default(0),
    receivedChunks: integer("received_chunks")
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastChunkAt: timestamp("last_chunk_at"),
  },
  (t) => ({
    ownerIdx: index("vault_upload_owner_idx").on(t.ownerUserId),
    lastChunkIdx: index("vault_upload_last_chunk_idx").on(t.lastChunkAt),
  })
)
