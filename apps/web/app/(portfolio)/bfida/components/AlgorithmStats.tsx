"use client"

import type { TraceStats } from "../lib/algorithm-trace"

type AlgorithmStatsProps = {
  stats: TraceStats
  className?: string
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 p-3 border border-black bg-white">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="text-lg font-semibold text-black font-mono">{value}</span>
    </div>
  )
}

export function AlgorithmStats({ stats, className }: AlgorithmStatsProps) {
  const directionLabel = stats.direction === "forward" ? "forward ->" : "<- backward"

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-gray-500">Search state</span>
        {stats.intersection && (
          <span className="text-[10px] uppercase tracking-wider text-[#5b3a9e] bg-[#bea9e9]/30 border border-[#bea9e9] rounded px-2 py-0.5 font-medium">
            frontier intersection!
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Direction" value={directionLabel} />
        <Stat label="Cutoff" value={stats.cutoff} />
        <Stat label="f = g + h" value={`${stats.f} = ${stats.g} + ${stats.h}`} />
        <Stat label="Nodes expanded" value={stats.nodesExpanded.toLocaleString()} />
        <Stat label="Frontier ->" value={stats.frontierForward.toLocaleString()} />
        <Stat label="<- Frontier" value={stats.frontierBackward.toLocaleString()} />
      </div>
    </div>
  )
}
