import { db } from "@cnet/db"
import { bfidaScores } from "@cnet/db/schema"
import { asc, count, eq } from "drizzle-orm"
import { Body, Controller, Get, Post, Query, Response, Route } from "tsoa"

type BoardKind = "english" | "european"

const STARTING_PEGS: Record<BoardKind, number> = { english: 32, european: 36 }
const FIRST_NAME_RE = /^[A-Za-z]{1,20}$/
const INITIAL_RE = /^[A-Za-z]$/
const MAX_TIME_MS = 24 * 60 * 60 * 1000

interface RecordScoreRequest {
  firstName: string
  lastInitial: string
  boardKind: BoardKind
  pegsRemaining: number
  /** Elapsed play time (first move to last move) in milliseconds. */
  timeMs: number
}

interface ScoreEntry {
  id: string
  firstName: string
  lastInitial: string
  boardKind: BoardKind
  pegsRemaining: number
  timeMs: number
  createdAt: string
}

interface ScoresPage {
  data: ScoreEntry[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

interface ScoreErrorResponse {
  error: string
}

/** "jOHN" -> "John": first letter upper, rest lower. */
function normalizeFirstName(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

@Route("bfida")
export class BfidaController extends Controller {
  /* GET /bfida/scores?board=english|european&page=0&pageSize=25 — paginated leaderboard,
     ranked by fewest pegs, then fastest time. */
  @Get("scores")
  public async listScores(
    @Query() board?: BoardKind,
    @Query() page = 0,
    @Query() pageSize = 25
  ): Promise<ScoresPage> {
    const safePage = Number.isInteger(page) && page >= 0 ? page : 0
    const safeSize = Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 25
    const where = board ? eq(bfidaScores.boardKind, board) : undefined

    const totalRows = await db.select({ value: count() }).from(bfidaScores).where(where)
    const total = totalRows[0]?.value ?? 0

    const rows = await db
      .select()
      .from(bfidaScores)
      .where(where)
      .orderBy(asc(bfidaScores.pegsRemaining), asc(bfidaScores.timeMs), asc(bfidaScores.createdAt))
      .limit(safeSize)
      .offset(safePage * safeSize)

    return {
      data: rows.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastInitial: r.lastInitial,
        boardKind: r.boardKind,
        pegsRemaining: r.pegsRemaining,
        timeMs: r.timeMs,
        createdAt: r.createdAt.toISOString(),
      })),
      page: safePage,
      pageSize: safeSize,
      total,
      hasMore: (safePage + 1) * safeSize < total,
    }
  }

  /* POST /bfida/scores — public submission; validated + normalized server-side */
  @Post("scores")
  @Response<ScoreErrorResponse>(400, "Invalid score submission")
  @Response<ScoreErrorResponse>(500, "Failed to save score")
  public async recordScore(
    @Body() body: RecordScoreRequest
  ): Promise<ScoreEntry | ScoreErrorResponse> {
    const firstNameRaw = (body.firstName ?? "").trim()
    const initialRaw = (body.lastInitial ?? "").trim()

    if (!FIRST_NAME_RE.test(firstNameRaw)) {
      this.setStatus(400)
      return { error: "First name must be 1-20 letters (A-Z only)." }
    }
    if (!INITIAL_RE.test(initialRaw)) {
      this.setStatus(400)
      return { error: "Last initial must be a single letter." }
    }
    if (body.boardKind !== "english" && body.boardKind !== "european") {
      this.setStatus(400)
      return { error: "boardKind must be 'english' or 'european'." }
    }
    const maxPegs = STARTING_PEGS[body.boardKind]
    if (
      !Number.isInteger(body.pegsRemaining) ||
      body.pegsRemaining < 1 ||
      body.pegsRemaining > maxPegs
    ) {
      this.setStatus(400)
      return { error: `pegsRemaining must be an integer between 1 and ${maxPegs}.` }
    }
    if (!Number.isInteger(body.timeMs) || body.timeMs < 0 || body.timeMs > MAX_TIME_MS) {
      this.setStatus(400)
      return { error: "timeMs must be a non-negative integer within 24h." }
    }

    const inserted = await db
      .insert(bfidaScores)
      .values({
        firstName: normalizeFirstName(firstNameRaw),
        lastInitial: initialRaw.toUpperCase(),
        boardKind: body.boardKind,
        pegsRemaining: body.pegsRemaining,
        timeMs: body.timeMs,
      })
      .returning()

    const row = inserted[0]
    if (!row) {
      this.setStatus(500)
      return { error: "Failed to save score." }
    }

    this.setStatus(201)
    return {
      id: row.id,
      firstName: row.firstName,
      lastInitial: row.lastInitial,
      boardKind: row.boardKind,
      pegsRemaining: row.pegsRemaining,
      timeMs: row.timeMs,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
