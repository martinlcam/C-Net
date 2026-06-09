import { Scoreboard } from "../components/Scoreboard"

type BfidaScoreboardSectionProps = {
  /** Bump to re-fetch after a new score is recorded. */
  refreshKey: number
}

export function BfidaScoreboardSection({ refreshKey }: BfidaScoreboardSectionProps) {
  return (
    <section
      id="leaderboard"
      className="border-b border-black px-6 sm:px-10 md:px-12 lg:px-20 py-16 md:py-24"
    >
      <div className="max-w-3xl mx-auto">
        <p className="text-gray-600 max-w-xl mb-8">
          Best runs by board. Fewest pegs left wins — toggle to compare the English and European
          boards.
        </p>
        <Scoreboard refreshKey={refreshKey} />
      </div>
    </section>
  )
}
