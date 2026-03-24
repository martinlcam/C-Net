import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { serviceEnum, statusEnum } from "./enums"

export const serviceStatuses = pgTable("service_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  service: serviceEnum("service").notNull().unique(),
  status: statusEnum("status").notNull(),
  lastCheck: timestamp("last_check").defaultNow().notNull(),
  responseTime: integer("response_time"),
  errorMessage: text("error_message"),
})
