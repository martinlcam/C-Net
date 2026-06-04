import { PortfolioHeroFrame } from "../../components/PortfolioHeroFrame"

export function BfidaHeroSection() {
  return (
    <PortfolioHeroFrame>
      <section className="flex-1 px-6 sm:px-10 md:px-12 lg:px-20 py-16 md:py-24">
        <div className="max-w-4xl">
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mb-6">
            An interactive demo
          </p>
          <h1 className="text-[56px] sm:text-[72px] md:text-[96px] font-bold text-black mb-10 tracking-tight leading-[0.95]">
            BFIDA
            <span className="text-[#bea9e9]">*.</span>
          </h1>

          <div className="space-y-5 text-base md:text-lg text-gray-700 leading-relaxed max-w-3xl">
            <p>
              Ever since I was young, I remember a 37-hole peg solitaire board tucked away in the
              drawer of my grandma's couch table -- a small wooden board covered in cool glass
              marbles, with the one in the middle always missing. I'd jump marble over marble,
              watch the pile shrink, and try to leave just one in the center. To this day I have
              never managed it. Turns out the 37-hole European board, with a center-empty start,
              has no single-peg-in-the-center solution at all - a 3-colour parity argument proves
              it - so my younger self was chasing the impossible. This page is my second attempt.
            </p>
            <p>
              Peg solitaire turns out to be a beloved playground for{" "}
              <span className="text-black font-medium">classical AI heuristic search</span>. The
              algorithm that powers the demo below, <em>Bidirectional Breadth-First Iterative
              Deepening A*</em>, sits on a lineage that goes back to A* (1968), Korf's IDA* (1985),
              and Zhou and Hansen's breadth-first heuristic search (2006) - foundational
              symbolic-AI work from the era before deep learning ate the world. In 2012 Barker and
              Korf combined them into a bidirectional variant that solves a board in seconds where
              previous state-of-the-art took an hour.
            </p>
            <p>
              <a
                href="/papers/bfida-peg-solitaire.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black underline underline-offset-4 hover:text-gray-600 transition-colors"
              >
                Barker and Korf (2012), "Solving Peg Solitaire with Bidirectional BFIDA*"
              </a>{" "}
              - AAAI 2012. The board layouts, pseudocode, and pruning ideas in the visualizer below
              all come from this paper.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 text-sm text-gray-500">
            <a
              href="#play"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-black bg-white text-black hover:bg-gray-100 transition-colors"
            >
              Play it
            </a>
            <a
              href="#solver"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-black bg-white text-black hover:bg-gray-100 transition-colors"
            >
              Watch the algorithm
            </a>
          </div>
        </div>
      </section>
    </PortfolioHeroFrame>
  )
}
