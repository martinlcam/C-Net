import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const infrastructureConfigs = pgTable("infrastructure_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  proxmoxHost: text("proxmox_host").notNull(),
  proxmoxUser: text("proxmox_user").notNull(),
  proxmoxToken: text("proxmox_token").notNull(),
  proxmoxVerifySSL: boolean("proxmox_verify_ssl").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
