import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Enums
export const auditActionEnum = pgEnum('audit_action', [
  'VM_CREATED',
  'VM_STARTED',
  'VM_STOPPED',
  'VM_DELETED',
  'VM_RESTARTED',
  'LXC_CREATED',
  'LXC_STARTED',
  'LXC_STOPPED',
  'LXC_DELETED',
  'STORAGE_EXPANDED',
  'CONFIG_UPDATED',
  'SERVICE_ENABLED',
  'SERVICE_DISABLED',
])

export const serviceEnum = pgEnum('service_type', [
  'pi-hole',
  'plex',
  'minecraft',
  'nas',
])

export const statusEnum = pgEnum('service_status', ['up', 'down', 'degraded'])

export const logStatusEnum = pgEnum('log_status', ['success', 'failed'])

// Users Table (for Auth.js compatibility)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name'),
  emailVerified: timestamp('email_verified'),
  image: text('image'),
  googleId: text('google_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  infrastructureConfigs: many(infrastructureConfigs),
  serviceCredentials: many(serviceCredentials),
  auditLogs: many(auditLogs),
  accounts: many(accounts),
  sessions: many(sessions),
}))

// Infrastructure Configuration
export const infrastructureConfigs = pgTable('infrastructure_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  proxmoxHost: text('proxmox_host').notNull(),
  proxmoxUser: text('proxmox_user').notNull(),
  proxmoxToken: text('proxmox_token').notNull(), // Will be encrypted in service layer
  proxmoxVerifySSL: boolean('proxmox_verify_ssl').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const infrastructureConfigsRelations = relations(
  infrastructureConfigs,
  ({ one }) => ({
    user: one(users, {
      fields: [infrastructureConfigs.userId],
      references: [users.id],
    }),
  })
)

// Service Credentials
export const serviceCredentials = pgTable('service_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  service: serviceEnum('service').notNull(),
  apiKey: text('api_key').notNull(), // Encrypted
  hostname: text('hostname').notNull(),
  port: integer('port').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const serviceCredentialsRelations = relations(
  serviceCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [serviceCredentials.userId],
      references: [users.id],
    }),
  })
)

// Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(), // 'vm', 'lxc', 'service'
    resourceId: text('resource_id').notNull(),
    changes: json('changes'), // {before: {}, after: {}}
    status: logStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
    ipAddress: text('ip_address'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    userIdTimestampIdx: index('audit_user_timestamp_idx').on(table.userId, table.timestamp),
    timestampIdx: index('audit_timestamp_idx').on(table.timestamp),
  })
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}))

// Metrics Snapshot (Time-series data)
export const metricsSnapshots = pgTable(
  'metrics_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nodeId: text('node_id').notNull(),
    cpuPercent: integer('cpu_percent').notNull(),
    ramPercent: integer('ram_percent').notNull(),
    diskPercent: integer('disk_percent').notNull(),
    networkTx: integer('network_tx').default(0),
    networkRx: integer('network_rx').default(0),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    nodeTimestampIdx: index('metrics_node_timestamp_idx').on(table.nodeId, table.timestamp),
    timestampIdx: index('metrics_timestamp_idx').on(table.timestamp),
  })
)

// Service Status
export const serviceStatuses = pgTable('service_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  service: serviceEnum('service').notNull().unique(),
  status: statusEnum('status').notNull(),
  lastCheck: timestamp('last_check').defaultNow().notNull(),
  responseTime: integer('response_time'), // milliseconds
  errorMessage: text('error_message'),
})

// Sessions (for Auth.js)
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: text('session_token').unique().notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
})

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

// Accounts (for Auth.js OAuth providers)
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
})

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

// Verification Tokens (for Auth.js email verification if needed)
export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires').notNull(),
})
