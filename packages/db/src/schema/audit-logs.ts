import { index, json, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { auditActionEnum, logStatusEnum } from "./enums"
import { users } from "./users"

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: auditActionEnum("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    changes: json("changes"),
    status: logStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    ipAddress: text("ip_address"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    userIdTimestampIdx: index("audit_user_timestamp_idx").on(table.userId, table.timestamp),
    timestampIdx: index("audit_timestamp_idx").on(table.timestamp),
  })
)
