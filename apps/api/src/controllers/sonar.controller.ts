import { db } from "@cnet/db"
import { sonarHotspots, sonarIssues } from "@cnet/db/schema"
import { SonarCloudService, type SonarHotspotRaw, type SonarIssueRaw } from "@cnet/engine"
import { desc, isNull, sql } from "drizzle-orm"
import { Controller, Get, Post, Query, Response, Route, Security } from "tsoa"

interface SonarErrorResponse {
  error: string
  message?: string
}

interface SonarSyncResult {
  issues: number
  hotspots: number
  total: number
  durationMs: number
}

interface SonarImpactDto {
  softwareQuality: string
  severity: string
}

interface SonarIssueDto {
  key: string
  rule: string
  severity: string
  type: string
  status: string
  issueStatus: string | null
  component: string
  filePath: string | null
  line: number | null
  message: string
  effort: string | null
  tags: string[]
  impacts: SonarImpactDto[]
  assignee: string | null
  creationDate: string | null
  updateDate: string | null
}

interface SonarIssuesPage {
  data: SonarIssueDto[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

/**
 * A unified row for the dashboard's combined list. Issues and hotspots are
 * normalized to a shared shape; `kind` distinguishes them and `priority` holds
 * the issue's severity or the hotspot's vulnerabilityProbability.
 */
interface SonarFindingDto {
  kind: "hotspot" | "issue"
  key: string
  rule: string
  priority: string
  category: string | null
  status: string
  component: string
  filePath: string | null
  line: number | null
  message: string
  tags: string[]
  creationDate: string | null
  updateDate: string | null
}

interface SonarFindingsPage {
  data: SonarFindingDto[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const SONAR_PROJECT_KEY = process.env.SONAR_PROJECT_KEY ?? "martinlcam_C-Net"
const SONAR_ORGANIZATION = process.env.SONAR_ORGANIZATION ?? "martinlcam"

function filePathFromComponent(component: string, projectKey: string): string | null {
  const prefix = `${projectKey}:`
  return component.startsWith(prefix) ? component.slice(prefix.length) : null
}

@Route("sonar")
@Security("jwt")
export class SonarController extends Controller {
  /**
   * POST /sonar/sync — pull every issue AND security hotspot from SonarCloud
   * into the local DB. This is the "deal with them locally" ingest route: it
   * mirrors the full sets into `sonar_issues` / `sonar_hotspots` (upsert by key),
   * keeping each full `raw` payload for offline/LLM use.
   */
  @Post("sync")
  @Response<SonarErrorResponse>(502, "SonarCloud request failed")
  @Response<SonarErrorResponse>(500, "Server error")
  public async syncIssues(): Promise<SonarSyncResult | SonarErrorResponse> {
    const start = Date.now()

    const service = new SonarCloudService({
      organization: SONAR_ORGANIZATION,
      projectKey: SONAR_PROJECT_KEY,
      token: process.env.SONAR_TOKEN || undefined,
    })

    let issues: SonarIssueRaw[]
    let hotspots: SonarHotspotRaw[]
    try {
      ;[issues, hotspots] = await Promise.all([
        service.fetchAllIssues(),
        service.fetchAllHotspots(),
      ])
    } catch (error) {
      this.setStatus(502)
      return {
        error: "Failed to fetch from SonarCloud",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }

    try {
      for (const issue of issues) {
        const row = {
          issueKey: issue.key,
          rule: issue.rule,
          severity: issue.severity,
          type: issue.type,
          status: issue.status,
          issueStatus: issue.issueStatus ?? null,
          resolution: issue.resolution ?? null,
          component: issue.component,
          filePath: filePathFromComponent(issue.component, SONAR_PROJECT_KEY),
          line: issue.line ?? null,
          message: issue.message,
          effort: issue.effort ?? null,
          tags: issue.tags ?? [],
          cleanCodeAttributeCategory: issue.cleanCodeAttributeCategory ?? null,
          impacts: issue.impacts ?? null,
          assignee: issue.assignee ?? null,
          creationDate: issue.creationDate ? new Date(issue.creationDate) : null,
          updateDate: issue.updateDate ? new Date(issue.updateDate) : null,
          raw: issue,
          syncedAt: new Date(),
        }

        await db
          .insert(sonarIssues)
          .values(row)
          .onConflictDoUpdate({ target: sonarIssues.issueKey, set: row })
      }

      for (const hotspot of hotspots) {
        const row = {
          hotspotKey: hotspot.key,
          ruleKey: hotspot.ruleKey,
          securityCategory: hotspot.securityCategory ?? null,
          vulnerabilityProbability: hotspot.vulnerabilityProbability,
          status: hotspot.status,
          resolution: hotspot.resolution ?? null,
          component: hotspot.component,
          filePath: filePathFromComponent(hotspot.component, SONAR_PROJECT_KEY),
          line: hotspot.line ?? null,
          message: hotspot.message,
          assignee: hotspot.assignee ?? null,
          creationDate: hotspot.creationDate ? new Date(hotspot.creationDate) : null,
          updateDate: hotspot.updateDate ? new Date(hotspot.updateDate) : null,
          raw: hotspot,
          syncedAt: new Date(),
        }

        await db
          .insert(sonarHotspots)
          .values(row)
          .onConflictDoUpdate({ target: sonarHotspots.hotspotKey, set: row })
      }

      return {
        issues: issues.length,
        hotspots: hotspots.length,
        total: issues.length + hotspots.length,
        durationMs: Date.now() - start,
      }
    } catch (error) {
      this.setStatus(500)
      return {
        error: "Failed to store SonarCloud data",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * GET /sonar/issues — a page of active (unresolved) issues for the dashboard,
   * served from the local DB and ordered by severity. Paginated for the
   * dashboard's infinite-scroll list (these are display snippets — the full
   * issue context for an LLM lives in the `raw` column via the sync route).
   */
  @Get("issues")
  @Response<SonarErrorResponse>(500, "Server error")
  public async getActiveIssues(
    @Query() page?: number,
    @Query() pageSize?: number
  ): Promise<SonarIssuesPage | SonarErrorResponse> {
    try {
      const p = Math.max(0, Math.floor(page ?? 0))
      const ps = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE)))

      // Order by severity in SQL so pagination is stable across pages.
      const severityOrder = sql`CASE ${sonarIssues.severity}
        WHEN 'BLOCKER' THEN 0
        WHEN 'CRITICAL' THEN 1
        WHEN 'MAJOR' THEN 2
        WHEN 'MINOR' THEN 3
        WHEN 'INFO' THEN 4
        ELSE 9 END`

      const rows = await db
        .select()
        .from(sonarIssues)
        .where(isNull(sonarIssues.resolution))
        .orderBy(severityOrder, desc(sonarIssues.creationDate))
        .limit(ps)
        .offset(p * ps)

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(sonarIssues)
        .where(isNull(sonarIssues.resolution))

      const data: SonarIssueDto[] = rows.map((row) => ({
        key: row.issueKey,
        rule: row.rule,
        severity: row.severity,
        type: row.type,
        status: row.status,
        issueStatus: row.issueStatus,
        component: row.component,
        filePath: row.filePath,
        line: row.line,
        message: row.message,
        effort: row.effort,
        tags: row.tags ?? [],
        impacts: row.impacts ?? [],
        assignee: row.assignee,
        creationDate: row.creationDate ? row.creationDate.toISOString() : null,
        updateDate: row.updateDate ? row.updateDate.toISOString() : null,
      }))

      return { data, page: p, pageSize: ps, total, hasMore: (p + 1) * ps < total }
    } catch (error) {
      this.setStatus(500)
      return {
        error: "Failed to load SonarCloud issues",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * GET /sonar/findings — a combined, paginated page of active findings for the
   * dashboard: security hotspots (status TO_REVIEW) first, ordered by
   * vulnerabilityProbability, then active issues ordered by severity. Both are
   * normalized to a shared shape and served from the local DB.
   */
  @Get("findings")
  @Response<SonarErrorResponse>(500, "Server error")
  public async getFindings(
    @Query() page?: number,
    @Query() pageSize?: number
  ): Promise<SonarFindingsPage | SonarErrorResponse> {
    try {
      const p = Math.max(0, Math.floor(page ?? 0))
      const ps = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE)))
      const offset = p * ps

      // UNION the two tables into one normalized, ordered stream. Hotspots
      // (sort_group 0) come before issues (1); within each, by priority rank
      // then newest first. Raw SQL keeps the heterogeneous union readable.
      const result = await db.execute(sql`
        SELECT kind, key, rule, priority, category, status, component,
               "filePath", line, message, tags, "creationDate", "updateDate"
        FROM (
          SELECT 'hotspot' AS kind, hotspot_key AS key, rule_key AS rule,
                 vulnerability_probability AS priority, security_category AS category,
                 status, component, file_path AS "filePath", line, message,
                 '[]'::jsonb AS tags, creation_date AS "creationDate",
                 update_date AS "updateDate", 0 AS sort_group,
                 CASE vulnerability_probability
                   WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'LOW' THEN 2 ELSE 9 END AS prio_rank
          FROM sonar_hotspots
          WHERE status = 'TO_REVIEW'
          UNION ALL
          SELECT 'issue' AS kind, issue_key AS key, rule AS rule,
                 severity AS priority, type AS category,
                 status, component, file_path AS "filePath", line, message,
                 tags, creation_date AS "creationDate",
                 update_date AS "updateDate", 1 AS sort_group,
                 CASE severity
                   WHEN 'BLOCKER' THEN 0 WHEN 'CRITICAL' THEN 1 WHEN 'MAJOR' THEN 2
                   WHEN 'MINOR' THEN 3 WHEN 'INFO' THEN 4 ELSE 9 END AS prio_rank
          FROM sonar_issues
          WHERE resolution IS NULL
        ) findings
        ORDER BY sort_group, prio_rank, "creationDate" DESC NULLS LAST
        LIMIT ${ps} OFFSET ${offset}
      `)

      const totalResult = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM sonar_hotspots WHERE status = 'TO_REVIEW') +
          (SELECT count(*) FROM sonar_issues WHERE resolution IS NULL) AS total
      `)
      const total = Number((totalResult.rows[0] as { total: number | string })?.total ?? 0)

      const rows = result.rows as unknown as Array<{
        kind: "hotspot" | "issue"
        key: string
        rule: string
        priority: string
        category: string | null
        status: string
        component: string
        filePath: string | null
        line: number | null
        message: string
        tags: string[] | null
        creationDate: Date | string | null
        updateDate: Date | string | null
      }>

      const data: SonarFindingDto[] = rows.map((row) => ({
        kind: row.kind,
        key: row.key,
        rule: row.rule,
        priority: row.priority,
        category: row.category,
        status: row.status,
        component: row.component,
        filePath: row.filePath,
        line: row.line,
        message: row.message,
        tags: row.tags ?? [],
        creationDate: row.creationDate ? new Date(row.creationDate).toISOString() : null,
        updateDate: row.updateDate ? new Date(row.updateDate).toISOString() : null,
      }))

      return { data, page: p, pageSize: ps, total, hasMore: (p + 1) * ps < total }
    } catch (error) {
      this.setStatus(500)
      return {
        error: "Failed to load SonarCloud findings",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
