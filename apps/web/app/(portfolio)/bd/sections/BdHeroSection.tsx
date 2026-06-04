"use client"

import type { BdConnectionState, BdStatusFrame } from "../lib/bd-types"

type Props = {
  status: BdStatusFrame
  connection: BdConnectionState
  source: string
}

const connectionLabel: Record<BdConnectionState, string> = {
  idle: "IDLE",
  connecting: "CONNECTING",
  open: "LINK.OPEN",
  reconnecting: "RETRYING",
  closed: "CLOSED",
  mock: "SYN.MOCK",
}

export function BdHeroSection({ status, connection, source }: Props) {
  const live = status.connected
  return (
    <section className="relative overflow-hidden border-b border-bd-rule px-6 sm:px-10 md:px-12 lg:px-20 py-14 md:py-20">
      {/* Decorative top tag-row, in The Designers Republic style. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-10 font-bd-mono text-[10px] uppercase tracking-[0.3em] text-bd-cream/45">
        <span>TX.001</span>
        <span className="text-bd-rule">/</span>
        <span>SECTOR 07</span>
        <span className="text-bd-rule">/</span>
        <span>NEURAL.OUTPUT</span>
        <span className="text-bd-rule">/</span>
        <span>v0.1</span>
        <span className="ml-auto text-bd-cream/55">{source || "—"}</span>
      </div>

      <div className="grid grid-cols-12 gap-6 items-end">
        <div className="col-span-12 md:col-span-7">
          <h1 className="font-bd-display font-bold leading-[0.85] text-bd-cream tracking-tight">
            <span className="block text-[120px] sm:text-[168px] md:text-[224px]">
              BD<span className="text-bd-purple">.</span>
            </span>
          </h1>
          <div className="mt-3 flex items-center gap-3 font-bd-mono text-[11px] uppercase tracking-[0.32em] text-bd-cream/55">
            <span>BRAINDANCE</span>
            <span className="text-bd-rule">/</span>
            <span>READOUT</span>
            <span className="text-bd-rule">/</span>
            <span className="text-bd-cream/40">脳波 EEG.4CH @ 256HZ</span>
          </div>
        </div>

        <div className="col-span-12 md:col-span-5">
          <div className="border border-bd-rule bg-bd-panel/40">
            <div className="flex items-center justify-between border-b border-bd-rule px-3 py-1.5 font-bd-mono text-[10px] uppercase tracking-[0.2em]">
              <span className="text-bd-cream/60">LINK.STATUS</span>
              <span className={live ? "text-bd-live bd-pulse" : "text-bd-alarm bd-pulse"}>
                {connectionLabel[connection]}
              </span>
            </div>
            <div className="grid grid-cols-2">
              <KV label="DEVICE" value={status.deviceName ?? "—"} className="border-r border-bd-rule" />
              <KV
                label="BATTERY"
                value={status.battery == null ? "—" : `${status.battery}%`}
              />
              <KV
                label="ADDR"
                value={status.address ? status.address.slice(-8) : "—"}
                className="border-r border-t border-bd-rule"
              />
              <KV
                label="RSSI"
                value={status.rssi == null ? "—" : `${status.rssi} dBm`}
                className="border-t border-bd-rule"
              />
            </div>
            <div className="border-t border-bd-rule px-3 py-2 font-bd-mono text-[10px] uppercase tracking-[0.18em] text-bd-cream/55">
              {status.note ?? (live ? "STREAMING" : "WAITING FOR HEADBAND")}
            </div>
          </div>
        </div>
      </div>

      {/* Manifesto paragraph, kept terse to let the type breathe. */}
      <p className="mt-10 max-w-3xl font-bd-display text-base md:text-lg leading-snug text-bd-cream/75">
        A public, real-time readout of my <span className="text-bd-cream">Muse 2</span> EEG
        headband. Four channels of cortex, one heart, one body. Bluetooth into a small Python
        bridge, fanned out over WebSocket, painted onto a canvas. Eventually it will think back.
      </p>
    </section>
  )
}

function KV({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`px-3 py-2.5 ${className}`}>
      <div className="font-bd-mono text-[9px] uppercase tracking-[0.22em] text-bd-cream/40">
        {label}
      </div>
      <div className="font-bd-display text-lg text-bd-cream tabular-nums truncate">{value}</div>
    </div>
  )
}
