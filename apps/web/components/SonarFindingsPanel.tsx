"use client"

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef } from "react"
import type { BadgeProps } from "@/stories/badge/badge"
import { Badge } from "@/stories/badge/badge"
import { Button } from "@/stories/button/button"
import { Card, CardContent, CardHeader } from "@/stories/card/card"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
const PAGE_SIZE = 50
/** Fixed height of the scroll viewport the virtualized list lives in. */
const LIST_HEIGHT = 560
/** Estimated row height; rows are measured precisely once rendered. */
const ESTIMATED_ROW = 78

type FindingKind = "hotspot" | "issue"

interface SonarFinding {
  kind: FindingKind
  key: string
  rule: string
  /** Issue severity (BLOCKER..INFO) or hotspot vulnerabilityProbability (HIGH/MEDIUM/LOW). */
  priority: string
  /** Issue type or hotspot securityCategory. */
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
  data: SonarFinding[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

interface SonarSyncResult {
  issues: number
  hotspots: number
  total: number
  durationMs: number
}

/** Build a detailed error including the HTTP status and any server-provided body. */
async function errorFrom(response: Response, fallback: string): Promise<Error> {
  let detail = ""
  try {
    const body = await response.json()
    if (body?.error) {
      detail = body.message ? `${body.error}: ${body.message}` : body.error
    }
  } catch {
    // Non-JSON response (e.g. a 404 HTML page) — status code alone will have to do.
  }
  const reason = detail || response.statusText || fallback
  return new Error(`HTTP ${response.status} — ${reason}`)
}

async function fetchFindingsPage(page: number): Promise<SonarFindingsPage> {
  const response = await fetch(`${API_BASE}/sonar/findings?page=${page}&pageSize=${PAGE_SIZE}`, {
    credentials: "include",
  })
  if (!response.ok) {
    throw await errorFrom(response, "Failed to load findings")
  }
  return (await response.json()) as SonarFindingsPage
}

async function syncFindings(): Promise<SonarSyncResult> {
  const response = await fetch(`${API_BASE}/sonar/sync`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) {
    throw await errorFrom(response, "Failed to sync")
  }
  return (await response.json()) as SonarSyncResult
}

/** Color a priority badge by severity (issues) or vulnerability probability (hotspots). */
function priorityVariant(priority: string): BadgeProps["variant"] {
  switch (priority) {
    case "BLOCKER":
    case "CRITICAL":
    case "HIGH":
      return "destructive"
    case "MAJOR":
    case "MEDIUM":
      return "warning"
    case "MINOR":
    case "LOW":
      return "secondary"
    default:
      return "outline"
  }
}

function formatCategory(category: string | null): string | null {
  if (!category) return null
  return category.replace(/_/g, " ").toLowerCase()
}

function FindingRow({ finding }: { finding: SonarFinding }) {
  const isHotspot = finding.kind === "hotspot"
  const category = formatCategory(finding.category)
  return (
    <div className="flex flex-col gap-1.5 border-b border-neutral-30 px-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isHotspot ? "destructive" : "secondary"}>
          {isHotspot ? "security hotspot" : "issue"}
        </Badge>
        <Badge variant={priorityVariant(finding.priority)}>{finding.priority}</Badge>
        {category ? (
          <span className="text-xs uppercase tracking-wide text-neutral-60">{category}</span>
        ) : null}
        <span className="text-sm font-medium text-neutral-100">{finding.message}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-70">
        {finding.filePath ? (
          <span className="font-mono">
            {finding.filePath}
            {finding.line ? `:${finding.line}` : ""}
          </span>
        ) : null}
        <span>{finding.rule}</span>
        {finding.tags.map((tag) => (
          <span key={tag} className="rounded bg-neutral-20 px-1.5 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SonarFindingsPanel() {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["sonar", "findings"],
      queryFn: ({ pageParam }) => fetchFindingsPage(pageParam),
      initialPageParam: 0,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  const sync = useMutation({
    mutationFn: syncFindings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sonar", "findings"] })
    },
  })

  const findings = data?.pages.flatMap((p) => p.data) ?? []
  const total = data?.pages[0]?.total ?? 0
  // One extra virtual row acts as the loader/sentinel when more pages exist.
  const rowCount = hasNextPage ? findings.length + 1 : findings.length

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW,
    overscan: 8,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Fetch the next page once the sentinel row scrolls into view.
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1]
    if (!last) return
    if (last.index >= findings.length && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [virtualItems, findings.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-100">
            SonarCloud Findings
          </h2>
          <p className="text-sm text-neutral-70">
            {total > 0 ? `${total} active finding${total === 1 ? "" : "s"}. ` : null}
            Security hotspots first, then issues. Sync pulls the full set into the local store.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? "Syncing…" : "Sync from SonarCloud"}
        </Button>
      </CardHeader>

      <CardContent>
        {sync.isError ? (
          <div className="mb-4 rounded-md border border-accent-red-30 bg-accent-red-10 p-3 text-sm text-accent-red-70">
            Sync failed: {sync.error instanceof Error ? sync.error.message : "Unknown error"}
          </div>
        ) : null}
        {sync.isSuccess ? (
          <div className="mb-4 rounded-md border border-accent-green-30 bg-accent-green-10 p-3 text-sm text-accent-green-70">
            Synced {sync.data.total} ({sync.data.issues} issues, {sync.data.hotspots} hotspots) in{" "}
            {sync.data.durationMs}ms.
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
            Error loading findings: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : findings.length === 0 ? (
          <div className="py-10 text-center text-neutral-70">
            No active findings. Run a sync to pull the latest from SonarCloud.
          </div>
        ) : (
          <div ref={scrollRef} className="overflow-auto" style={{ height: LIST_HEIGHT }}>
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
            >
              {virtualItems.map((virtualRow) => {
                const isSentinel = virtualRow.index >= findings.length
                const finding = findings[virtualRow.index]
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isSentinel ? (
                      <div className="flex items-center justify-center py-4 text-sm text-neutral-70">
                        {isFetchingNextPage ? <LoadingSpinner size="sm" /> : "Scroll for more…"}
                      </div>
                    ) : finding ? (
                      <FindingRow finding={finding} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
