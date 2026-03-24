import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const metricsSnapshots = pgTable(
  "metrics_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: text("node_id").notNull(),
    cpuPercent: integer("cpu_percent").notNull(),
    ramPercent: integer("ram_percent").notNull(),
    diskPercent: integer("disk_percent").notNull(),
    networkTx: integer("network_tx").default(0),
    networkRx: integer("network_rx").default(0),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    nodeTimestampIdx: index("metrics_node_timestamp_idx").on(table.nodeId, table.timestamp),
    timestampIdx: index("metrics_timestamp_idx").on(table.timestamp),
  })
)
