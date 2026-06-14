import { relations } from "drizzle-orm"
import { accounts } from "./accounts"
import { auditLogs } from "./audit-logs"
import { infrastructureConfigs } from "./infrastructure-configs"
import { serviceCredentials } from "./service-credentials"
import { sessions } from "./sessions"
import { users } from "./users"
import { vaultDirectories } from "./vault-directories"
import { vaultFiles } from "./vault-files"
import { vaultUploads } from "./vault-uploads"

export const usersRelations = relations(users, ({ many }) => ({
  infrastructureConfigs: many(infrastructureConfigs),
  serviceCredentials: many(serviceCredentials),
  auditLogs: many(auditLogs),
  accounts: many(accounts),
  sessions: many(sessions),
  vaultFiles: many(vaultFiles),
  vaultDirectories: many(vaultDirectories),
  vaultUploads: many(vaultUploads),
}))

export const vaultFilesRelations = relations(vaultFiles, ({ one }) => ({
  owner: one(users, { fields: [vaultFiles.ownerUserId], references: [users.id] }),
  directory: one(vaultDirectories, {
    fields: [vaultFiles.directoryId],
    references: [vaultDirectories.id],
  }),
}))

export const vaultDirectoriesRelations = relations(vaultDirectories, ({ one, many }) => ({
  owner: one(users, { fields: [vaultDirectories.ownerUserId], references: [users.id] }),
  files: many(vaultFiles),
}))

export const vaultUploadsRelations = relations(vaultUploads, ({ one }) => ({
  owner: one(users, { fields: [vaultUploads.ownerUserId], references: [users.id] }),
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
