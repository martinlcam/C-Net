import { Scoreboard } from "../components/Scoreboard"

type BfidaScoreboardSectionProps = {
  /** Bump to re-fetch after a new score is recorded. */
  refreshKey: number
}

export function BfidaScoreboardSection({ refreshKey }: BfidaScoreboardSectionProps) {
  return (
    <section id="leaderboard" className="border-b border-black scroll-mt-[65px]">
      {/* Centered column framed by a vertical rule on each side, spanning top-to-bottom.
          No horizontal padding here so the row underlines reach both rules. */}
      <div className="max-w-7xl mx-auto border-l border-r border-black py-16 md:py-24">
        <Scoreboard refreshKey={refreshKey} />
      </div>
    </section>
  )
}
