/** A small line of recent values, scaled to its own maximum; the newest point is at the right. */
export function Sparkline({
  values,
  width = 96,
  height = 20,
  className = "stroke-primary-purple-60",
  label,
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
  label: string
}) {
  const max = Math.max(1, ...values)
  const n = values.length
  const points = values
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
    >
      {n > 1 ? (
        <polyline
          points={points}
          className={`fill-none ${className}`}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
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
