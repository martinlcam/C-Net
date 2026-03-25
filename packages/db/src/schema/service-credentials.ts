import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { serviceEnum } from "./enums"
import { users } from "./users"

export const serviceCredentials = pgTable("service_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  service: serviceEnum("service").notNull(),
  apiKey: text("api_key").notNull(),
  hostname: text("hostname").notNull(),
  port: integer("port").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
