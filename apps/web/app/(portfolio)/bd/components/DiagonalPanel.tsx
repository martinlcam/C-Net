import type { CSSProperties, ReactNode } from "react"

type PanelProps = {
  children: ReactNode
  label?: string
  meta?: string
  tone?: "default" | "live" | "alarm"
  cut?: "tr" | "bl" | "tr-bl" | "none"
  /** Wedge fill behind chamfer corners — defaults to panel fill. */
  surface?: string
  className?: string
}

const BORDER: Record<NonNullable<PanelProps["tone"]>, string> = {
  default: "rgba(250,246,241,0.15)",
  live: "rgba(198,255,0,0.4)",
  alarm: "rgba(255,51,68,0.45)",
}

const BORDER_CLASS: Record<NonNullable<PanelProps["tone"]>, string> = {
  default: "border-bd-rule",
  live: "border-bd-live/40",
  alarm: "border-bd-alarm/40",
}

/**
 * Vectorheart data plate: full rectangular border (corners stay connected),
 * optional 45° chamfer overlays that mask the square corner without clip-path.
 */
export function DiagonalPanel({
  children,
  label,
  meta,
  tone = "default",
  cut = "none",
  surface = "#16161a",
  className = "",
}: PanelProps) {
  const accent =
    tone === "live" ? "text-bd-live" : tone === "alarm" ? "text-bd-alarm" : "text-bd-cream/60"

  const frameStyle = {
    "--bd-surface": surface,
    "--bd-frame-border": BORDER[tone],
    "--bd-chamfer-size": "14px",
  } as CSSProperties

  const showTr = cut === "tr" || cut === "tr-bl"
  const showBl = cut === "bl" || cut === "tr-bl"

  return (
    <div className={`relative h-full ${className}`} style={frameStyle}>
      {showTr && <span className="bd-chamfer bd-chamfer-tr" aria-hidden />}
      {showBl && <span className="bd-chamfer bd-chamfer-bl" aria-hidden />}
      <div
        className={`relative z-0 flex h-full flex-col border bg-bd-panel/80 ${BORDER_CLASS[tone]}`}
      >
        {(label || meta) && (
          <div
            className={`relative z-10 flex shrink-0 items-center justify-between border-b bg-bd-panel px-3 py-1.5 font-bd-mono text-[10px] uppercase tracking-[0.18em] ${BORDER_CLASS[tone]}`}
          >
            <span className={accent}>{label}</span>
            <span className="text-bd-cream/40">{meta}</span>
          </div>
        )}
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
