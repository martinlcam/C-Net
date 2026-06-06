import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * SonarCloud security hotspots — a separate entity from issues (different API,
 * `/api/hotspots/search`, and a different shape). Hotspots are security-sensitive
 * spots needing review; their priority signal is `vulnerabilityProbability`
 * (HIGH/MEDIUM/LOW) and their lifecycle is TO_REVIEW → REVIEWED. Rows are
 * upserted by `hotspotKey`. Full payload kept in `raw` for offline/LLM use.
 */
export const sonarHotspots = pgTable(
  "sonar_hotspots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotspotKey: text("hotspot_key").notNull().unique(),
    ruleKey: text("rule_key").notNull(),
    securityCategory: text("security_category"),
    /** HIGH / MEDIUM / LOW — the priority signal. */
    vulnerabilityProbability: text("vulnerability_probability").notNull(),
    /** TO_REVIEW (active) or REVIEWED. */
    status: text("status").notNull(),
    /** Set once reviewed: SAFE / FIXED / ACKNOWLEDGED. */
    resolution: text("resolution"),
    component: text("component").notNull(),
    filePath: text("file_path"),
    line: integer("line"),
    message: text("message").notNull(),
    assignee: text("assignee"),
    creationDate: timestamp("creation_date"),
    updateDate: timestamp("update_date"),
    raw: jsonb("raw").notNull(),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("sonar_hotspots_status_idx").on(table.status),
    probabilityIdx: index("sonar_hotspots_probability_idx").on(table.vulnerabilityProbability),
  })
)
