import { db } from "@cnet/db"
import { bfidaScores } from "@cnet/db/schema"
import { asc, eq } from "drizzle-orm"
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

interface ScoreErrorResponse {
  error: string
}

/** "jOHN" -> "John": first letter upper, rest lower. */
function normalizeFirstName(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

@Route("bfida")
export class BfidaController extends Controller {
  /* GET /bfida/scores?board=english|european — public leaderboard, fewest pegs first */
  @Get("scores")
  public async listScores(@Query() board?: BoardKind): Promise<ScoreEntry[]> {
    const rows = await db
      .select()
      .from(bfidaScores)
      .where(board ? eq(bfidaScores.boardKind, board) : undefined)
      .orderBy(asc(bfidaScores.pegsRemaining), asc(bfidaScores.timeMs), asc(bfidaScores.createdAt))
      .limit(20)

    return rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastInitial: r.lastInitial,
      boardKind: r.boardKind,
      pegsRemaining: r.pegsRemaining,
      timeMs: r.timeMs,
      createdAt: r.createdAt.toISOString(),
    }))
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
