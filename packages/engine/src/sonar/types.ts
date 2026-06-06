/** Types for the SonarCloud Web API `/api/issues/search` endpoint. */

export interface SonarTextRange {
  startLine?: number
  endLine?: number
  startOffset?: number
  endOffset?: number
}

export interface SonarImpact {
  softwareQuality: string
  severity: string
}

/**
 * A single issue as returned by SonarCloud's `/api/issues/search`. Field names
 * mirror the real payload (verified against the live API). Any additional
 * fields are still preserved by callers via the full raw object.
 */
export interface SonarIssueRaw {
  key: string
  rule: string
  severity: string
  type: string
  status: string
  /** Newer clean-code lifecycle status. */
  issueStatus?: string
  /** Present only for resolved issues (FIXED, WONTFIX, ...). */
  resolution?: string
  component: string
  project?: string
  line?: number
  hash?: string
  textRange?: SonarTextRange
  message: string
  effort?: string
  debt?: string
  /** Login the issue is assigned to. SonarCloud often omits `author` entirely. */
  assignee?: string
  author?: string
  tags?: string[]
  cleanCodeAttribute?: string
  cleanCodeAttributeCategory?: string
  impacts?: SonarImpact[]
  creationDate?: string
  updateDate?: string
  [key: string]: unknown
}

export interface SonarPaging {
  pageIndex: number
  pageSize: number
  total: number
}

export interface SonarSearchResponse {
  total?: number
  p?: number
  ps?: number
  paging?: SonarPaging
  issues: SonarIssueRaw[]
}

/**
 * A security hotspot from `/api/hotspots/search`. Distinct from an issue: its
 * priority is `vulnerabilityProbability` and its lifecycle is `status`
 * TO_REVIEW → REVIEWED. Extra fields are preserved by callers via the raw object.
 */
export interface SonarHotspotRaw {
  key: string
  component: string
  project?: string
  securityCategory?: string
  vulnerabilityProbability: string
  status: string
  /** Set once reviewed: SAFE / FIXED / ACKNOWLEDGED. */
  resolution?: string
  line?: number
  message: string
  assignee?: string
  ruleKey: string
  textRange?: SonarTextRange
  creationDate?: string
  updateDate?: string
  [key: string]: unknown
}

export interface SonarHotspotSearchResponse {
  paging?: SonarPaging
  hotspots: SonarHotspotRaw[]
}
