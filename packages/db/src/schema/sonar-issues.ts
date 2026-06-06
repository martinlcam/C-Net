import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * SonarCloud issues pulled from the Web API and cached locally.
 *
 * This table is the local store for the "pull everything down" sync route so an
 * LLM can work through issues offline. It is global (not per-user) because it
 * mirrors a single SonarCloud project. Rows are upserted by `issueKey`.
 */
export const sonarIssues = pgTable(
  "sonar_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueKey: text("issue_key").notNull().unique(),
    rule: text("rule").notNull(),
    /** Legacy severity (BLOCKER..INFO). Still returned alongside `impacts`. */
    severity: text("severity").notNull(),
    /** Legacy type (BUG/VULNERABILITY/CODE_SMELL). */
    type: text("type").notNull(),
    status: text("status").notNull(),
    /** Newer clean-code lifecycle status (OPEN/ACCEPTED/FIXED/...). */
    issueStatus: text("issue_status"),
    /** Only present once an issue is resolved (FIXED/WONTFIX/etc). Null = active. */
    resolution: text("resolution"),
    component: text("component").notNull(),
    /** `component` with the `<projectKey>:` prefix stripped, e.g. apps/web/foo.ts. */
    filePath: text("file_path"),
    line: integer("line"),
    message: text("message").notNull(),
    effort: text("effort"),
    tags: jsonb("tags").$type<string[]>().notNull(),
    /** SonarCloud clean-code attribute category (CONSISTENT/INTENTIONAL/...). */
    cleanCodeAttributeCategory: text("clean_code_attribute_category"),
    /** Clean-code impacts, e.g. [{ softwareQuality: "MAINTAINABILITY", severity: "LOW" }]. */
    impacts: jsonb("impacts").$type<{ softwareQuality: string; severity: string }[]>(),
    /** Login of the user the issue is assigned to (present; `author` often is not). */
    assignee: text("assignee"),
    creationDate: timestamp("creation_date"),
    updateDate: timestamp("update_date"),
    /** Full raw issue payload from SonarCloud, retained for the LLM. */
    raw: jsonb("raw").notNull(),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("sonar_issues_status_idx").on(table.status),
    typeIdx: index("sonar_issues_type_idx").on(table.type),
    resolutionIdx: index("sonar_issues_resolution_idx").on(table.resolution),
  })
)
