import { DiagonalPanel } from "../components/DiagonalPanel"
import type { BdStatusFrame } from "../lib/bd-types"

type Props = {
  status: BdStatusFrame
}

/**
 * The "data sheet" footer block — Designers Republic packaging tics: a giant
 * specimen ID, a barcode strip, a wall of small print, and unnecessarily-loud
 * trademark stamps. Pure decoration; sets the page's authorial mood.
 */
export function BdSpecimenSection({ status }: Props) {
  const id = status.deviceName ?? "MUSE-OFFLINE"
  return (
    <section className="border-b border-bd-rule px-6 sm:px-10 md:px-12 lg:px-20 py-10 md:py-14">
      <div className="grid grid-cols-12 gap-6">
        {/* Specimen plate. */}
        <div className="col-span-12 md:col-span-7">
          <div className="font-bd-mono text-[10px] uppercase tracking-[0.32em] text-bd-cream/50 mb-3">
            SPECIMEN / NCG-2 / 脳
          </div>
          <div className="font-bd-display text-[64px] sm:text-[88px] leading-[0.9] font-bold tracking-tight text-bd-cream">
            {id.toUpperCase()}
            <span className="text-bd-purple">®</span>
          </div>
          <div className="mt-3 h-3 bd-barcode opacity-80" />
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 font-bd-mono text-[10px] uppercase tracking-[0.22em] text-bd-cream/55 max-w-md">
            <Row k="MFR" v="INTERAXON" />
            <Row k="MODEL" v="MUSE 2" />
            <Row k="CHANNELS" v="EEG 4 / PPG 3 / IMU 6" />
            <Row k="RATES" v="256 / 64 / 52 HZ" />
            <Row k="RES" v="14 BIT" />
            <Row k="TX" v="BLE 4.2" />
          </div>
        </div>

        {/* Legal-y wall of trademarks. */}
        <div className="col-span-12 md:col-span-5 h-full min-h-[200px]">
          <DiagonalPanel cut="tr" surface="#0d0d0f" className="h-full">
            <div className="flex h-full flex-col gap-3 p-4">
              <div className="font-bd-mono text-[10px] uppercase tracking-[0.32em] text-bd-cream/45">
                EDITORIAL.NOTE
              </div>
              <p className="font-bd-display text-sm leading-relaxed text-bd-cream/75">
                READOUT IS PUBLIC AND EPHEMERAL™. NO SAMPLES ARE PERSISTED. THE BRAINDANCE EDITOR
                IS A WORK OF JOURNALISM, NOT MEDICINE©. RAW DATA STREAMED VIA REDIS PUB/SUB OVER
                WEBSOCKET, RENDERED AT 30 HZ, IGNORED AT THE READER'S DISCRETION®.
              </p>
              <div className="mt-auto pt-3 border-t border-bd-rule grid grid-cols-3 gap-2 font-bd-mono text-[9px] uppercase tracking-[0.22em] text-bd-cream/40">
                <span>™ NCG-2</span>
                <span>© M.CAM</span>
                <span>® C-NET</span>
              </div>
            </div>
          </DiagonalPanel>
        </div>
      </div>
    </section>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[minmax(4.5rem,auto)_1fr] items-baseline gap-x-3 gap-y-0.5 border-b border-bd-rule pb-1.5">
      <span className="text-bd-cream/40 shrink-0">{k}</span>
      <span className="text-bd-cream text-right sm:text-left">{v}</span>
    </div>
  )
}
