import { Scoreboard } from "../components/Scoreboard"

type BfidaScoreboardSectionProps = {
  /** Bump to re-fetch after a new score is recorded. */
  refreshKey: number
}

export function BfidaScoreboardSection({ refreshKey }: BfidaScoreboardSectionProps) {
  return (
    <section id="leaderboard" className="border-b border-black">
      {/* Centered column framed by vertical rules that span the section top-to-bottom — no inner box. */}
      <div className="max-w-3xl mx-auto border-l border-r border-black px-8 sm:px-12 md:px-16 py-16 md:py-24">
        <Scoreboard refreshKey={refreshKey} />
      </div>
    </section>
  )
}
