/**
 * Decorative Vectorheart geometry — explicit 45° / 60° ray bursts, slash bands,
 * and wireframe chevrons. Behind content; pointer-events none. SVG/CSS only.
 */

function RayBurst({
  className,

  originX,

  originY,

  anglesDeg,

  length,
}: {
  className: string

  originX: number

  originY: number

  anglesDeg: number[]

  length: number
}) {
  return (
    <svg className={className} viewBox="0 0 400 400" fill="none" aria-hidden>
      {anglesDeg.map((deg, i) => {
        const rad = (deg * Math.PI) / 180

        const x2 = originX + Math.cos(rad) * length

        const y2 = originY + Math.sin(rad) * length

        return (
          <line
            key={`ray-${deg.toFixed(2)}`}
            x1={originX}
            y1={originY}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={i % 4 === 0 ? 1.5 : 0.85}
          />
        )
      })}
    </svg>
  )
}

const RAYS_45_UR = Array.from({ length: 22 }, (_, i) => -90 + i * 8.2)

const RAYS_60_LL = Array.from({ length: 16 }, (_, i) => 112 + i * 5.8)

export function BdVectorField() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <RayBurst
        className="absolute -right-[6%] -top-[10%] h-[58vh] w-[58vw] min-w-[440px] text-bd-cream/[0.11]"
        originX={400}
        originY={0}
        anglesDeg={RAYS_45_UR}
        length={460}
      />
      <RayBurst
        className="absolute -bottom-[16%] -left-[4%] h-[48vh] w-[52vw] min-w-[400px] text-bd-purple/[0.14]"
        originX={0}
        originY={400}
        anglesDeg={RAYS_60_LL}
        length={420}
      />
      <svg
        className="absolute left-[4%] top-[22%] h-[280px] w-[200px] text-bd-live/[0.14]"
        viewBox="0 0 120 280"
        fill="none"
        aria-hidden
      >
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`slash45-y${i * 32}`}
            x1={0}
            y1={i * 32}
            x2={120}
            y2={i * 32 + 120}
            stroke="currentColor"
            strokeWidth={i === 4 ? 1.4 : 0.75}
          />
        ))}
      </svg>
      <svg
        className="absolute right-[12%] top-[48%] h-32 w-32 text-bd-cream/[0.1]"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <path d="M10 50 L50 10 L90 50" stroke="currentColor" strokeWidth="1" />
        <path d="M10 50 L50 90 L90 50" stroke="currentColor" strokeWidth="0.75" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.65" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="0.65" />
      </svg>
      <div className="absolute left-[-18%] top-[36%] h-[4px] w-[136%] origin-center rotate-45 bg-bd-live/[0.16]" />
      <div className="absolute left-[-12%] top-[58%] h-px w-[124%] origin-center rotate-45 bg-bd-cream/[0.1]" />
      <div className="absolute left-[-14%] top-[72%] h-px w-[128%] origin-center -rotate-[60deg] bg-bd-purple/[0.12]" />
      <div className="bd-vector-grid absolute inset-0" />
    </div>
  )
}
