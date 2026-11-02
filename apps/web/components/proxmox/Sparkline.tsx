/**
 * A small line of recent values scaled to its own maximum; the newest point is at the right.
 * A second series shares the scale and draws lighter, so in/out or read/write read as one
 * picture rather than two charts.
 */
export function Sparkline({
  values,
  secondary,
  width = 96,
  height = 20,
  className = "stroke-primary-purple-60",
  secondaryClassName = "stroke-primary-purple-30",
  label,
}: {
  values: number[]
  secondary?: number[]
  width?: number
  height?: number
  className?: string
  secondaryClassName?: string
  label: string
}) {
  const max = Math.max(1, ...values, ...(secondary ?? []))
  const n = Math.max(values.length, secondary?.length ?? 0)
  const points = (series: number[]) =>
    series
      .map((v, i) => {
        const x = n > 1 ? (i / (n - 1)) * (width - 2) + 1 : width / 2
        const y = height - 1 - (v / max) * (height - 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ")
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="max-w-full"
    >
      {n > 1 ? (
        <>
          {secondary && secondary.length > 1 ? (
            <polyline
              points={points(secondary)}
              className={`fill-none ${secondaryClassName}`}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ) : null}
          <polyline
            points={points(values)}
            className={`fill-none ${className}`}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </>
      ) : (
        <line
          x1={1}
          x2={width - 1}
          y1={height - 1}
          y2={height - 1}
          className="stroke-neutral-30"
          strokeWidth={1}
        />
      )}
    </svg>
  )
}
