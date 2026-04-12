import { relations } from "drizzle-orm"
import { accounts } from "./accounts"
import { auditLogs } from "./audit-logs"
import { infrastructureConfigs } from "./infrastructure-configs"
import { serviceCredentials } from "./service-credentials"
import { sessions } from "./sessions"
import { users } from "./users"

export const usersRelations = relations(users, ({ many }) => ({
  infrastructureConfigs: many(infrastructureConfigs),
  serviceCredentials: many(serviceCredentials),
  auditLogs: many(auditLogs),
  accounts: many(accounts),
  sessions: many(sessions),
}))

export const infrastructureConfigsRelations = relations(infrastructureConfigs, ({ one }) => ({
  user: one(users, { fields: [infrastructureConfigs.userId], references: [users.id] }),
}))

export const serviceCredentialsRelations = relations(serviceCredentials, ({ one }) => ({
  user: one(users, { fields: [serviceCredentials.userId], references: [users.id] }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))
