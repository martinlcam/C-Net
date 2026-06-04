import type { CSSProperties } from "react"

type Props = {
  note?: string
}

/**
 * Full-bleed "no link" overlay shown when the bridge is down or the headband
 * isn't connected.
 */
export function NoSignalScreen({ note }: Props) {
  return (
    <div className="relative h-full w-full bd-hatch">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div
          className="relative border border-bd-alarm bg-bd-alarm/10 px-6 py-3"
          style={
            {
              "--bd-surface": "#16161a",
              "--bd-frame-border": "rgba(255,51,68,0.45)",
            } as CSSProperties
          }
        >
          <span className="bd-chamfer bd-chamfer-tr" aria-hidden />
          <span className="bd-chamfer bd-chamfer-bl" aria-hidden />
          <div className="relative z-[1] font-bd-display text-2xl tracking-[0.4em] text-bd-alarm">
            EEG NOT CONNECTED
          </div>
        </div>
        <div className="font-bd-mono text-[11px] uppercase tracking-[0.3em] text-bd-cream/60">
          {note ?? "AWAITING NEURAL LINK"}
        </div>
        <div className="font-bd-mono text-[10px] text-bd-cream/40 max-w-md text-center leading-relaxed mt-2">
          PWR.CYCLE HEADBAND / CLOSE MOBILE MUSE APP / RUN{" "}
          <span className="text-bd-cream/80">python -m neural_bridge run</span>
        </div>
      </div>
    </div>
  )
}
