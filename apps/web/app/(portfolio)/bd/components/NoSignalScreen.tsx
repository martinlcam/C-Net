type Props = {

  note?: string

}



/**

 * Offline state — only inside the EEG panel body (below the panel header).

 * No absolute positioning; parent supplies overflow-hidden + min-h-0.

 */

export function NoSignalScreen({ note }: Props) {

  return (

    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-hidden px-6 py-8">

      <p className="font-bd-display text-center text-xl sm:text-2xl tracking-[0.24em] text-bd-alarm">

        EEG NOT CONNECTED

      </p>

      <p className="font-bd-mono text-center text-[10px] uppercase tracking-[0.22em] text-bd-cream/55">

        {note ?? "AWAITING NEURAL LINK"}

      </p>

      <p className="max-w-[340px] text-center font-bd-mono text-[9px] leading-relaxed text-bd-cream/35">

        Web Bluetooth API support coming soon

      </p>

    </div>

  )

}


