import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { bfidaBoardKindEnum } from "./enums"

/**
 * Peg-solitaire ("bfida" marble game) high scores. Public, unauthenticated
 * submissions from the portfolio game page. Lower `pegsRemaining` is better
 * (1 = a perfect English solve); the leaderboard ranks by it ascending.
 */
export const bfidaScores = pgTable("bfida_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastInitial: text("last_initial").notNull(),
  boardKind: bfidaBoardKindEnum("board_kind").notNull(),
  pegsRemaining: integer("pegs_remaining").notNull(),
  /** Elapsed play time, first move to last move, in milliseconds. */
  timeMs: integer("time_ms").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
