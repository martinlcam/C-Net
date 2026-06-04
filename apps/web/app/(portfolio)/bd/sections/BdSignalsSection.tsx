"use client"

import { BandPowerBars } from "../components/BandPowerBars"
import { ContactQualityHud } from "../components/ContactQualityHud"
import { DiagonalPanel } from "../components/DiagonalPanel"
import { EegOscilloscope } from "../components/EegOscilloscope"
import { HeartRateDial } from "../components/HeartRateDial"
import { ImuTrace } from "../components/ImuTrace"
import { NoSignalScreen } from "../components/NoSignalScreen"
import type { BdStatusFrame } from "../lib/bd-types"
import type { BdRingBuffer } from "../lib/use-bd-stream"

type Props = {
  buffer: BdRingBuffer
  status: BdStatusFrame
}

export function BdSignalsSection({ buffer, status }: Props) {
  const live = status.connected
  return (
    <section className="border-b border-bd-rule px-6 sm:px-10 md:px-12 lg:px-20 py-10 md:py-14">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-bd-mono text-[11px] uppercase tracking-[0.32em] text-bd-cream/55">
          // SIGNAL DECK
        </h2>
        <span className="font-bd-mono text-[10px] uppercase tracking-[0.22em] text-bd-cream/35">
          REFRESH 30 HZ
        </span>
      </div>

      {/* Primary row: oscilloscope spans 8 cols, HSI rail spans 4. */}
      <div className="grid grid-cols-12 gap-4">
        <DiagonalPanel
          className="col-span-12 lg:col-span-8 h-[360px]"
          label="EEG.RAW / CH4 / 256HZ"
          meta={live ? "ROLLING 5S" : "OFFLINE"}
          tone={live ? "live" : "alarm"}
          cut="tr"
          surface="#16161a"
        >
          {live ? <EegOscilloscope buffer={buffer} /> : <NoSignalScreen note={status.note} />}
        </DiagonalPanel>

        <DiagonalPanel
          className="col-span-12 lg:col-span-4 h-[360px]"
          label="HSI.HORSESHOE"
          meta="FIT QUALITY"
          cut="bl"
          surface="#16161a"
        >
          <ContactQualityHud hsi={status.hsi} />
        </DiagonalPanel>
      </div>

      {/* Secondary row: band powers (5 cols), heart rate (4 cols), accelerometer (3 cols). */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <DiagonalPanel
          className="col-span-12 md:col-span-6 lg:col-span-5 h-[200px]"
          label="BAND.POWER / DELTA→GAMMA"
          meta="FFT 256pt"
          tone="live"
          cut="tr"
          surface="#16161a"
        >
          <BandPowerBars buffer={buffer} />
        </DiagonalPanel>

        <DiagonalPanel
          className="col-span-12 md:col-span-6 lg:col-span-4 h-[200px]"
          label="HEART.RATE / PPG.IR"
          meta="MUSE-2"
          cut="bl"
          surface="#16161a"
        >
          <HeartRateDial buffer={buffer} />
        </DiagonalPanel>

        <DiagonalPanel
          className="col-span-12 lg:col-span-3 h-[200px]"
          label="ACC / 3-AXIS"
          meta="±g"
        >
          <ImuTrace buffer={buffer} kind="acc" />
        </DiagonalPanel>
      </div>

      {/* Tertiary row: gyroscope full-width. */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <DiagonalPanel
          className="col-span-12 h-[140px]"
          label="GYRO / 3-AXIS"
          meta="DEG·s⁻¹ / 52HZ"
          cut="bl"
          surface="#16161a"
        >
          <ImuTrace buffer={buffer} kind="gyro" />
        </DiagonalPanel>
      </div>
    </section>
  )
}
