"use client"

import { PSEUDOCODE, type PseudocodeLine } from "../lib/pseudocode"

type PseudocodePanelProps = {
  highlight: string[]
  className?: string
}

export function PseudocodePanel({ highlight, className }: PseudocodePanelProps) {
  const isLit = (id: string) => highlight.includes(id)

  return (
    <div
      className={`rounded-xl border border-black bg-[#0f0d1a] text-[13px] leading-[1.6] font-mono overflow-hidden ${className ?? ""}`}
    >
      <div className="flex items-center px-4 py-2 border-b border-white/10 bg-[#0a0814]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#bea9e9]" />
          <span className="text-gray-300 text-xs uppercase tracking-wider">
            Bidirectional BFIDA*
          </span>
        </div>
      </div>
      <pre className="px-0 py-3 overflow-x-auto">
        {PSEUDOCODE.map((line: PseudocodeLine) => {
          const lit = isLit(line.id)
          return (
            <div
              key={line.id}
              className={`flex items-stretch transition-colors duration-150 ${
                lit ? "bg-[#bea9e9]/15" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1 shrink-0 ${lit ? "bg-[#bea9e9]" : "bg-transparent"}`}
              />
              <span className="w-9 shrink-0 text-right pr-2 text-gray-500 select-none">
                {line.id.slice(1)}
              </span>
              <span
                className={`pl-1 pr-4 whitespace-pre ${
                  lit ? "text-white" : line.text === "" ? "text-transparent" : "text-gray-400"
                }`}
              >
                {`${"  ".repeat(line.indent)}${line.text || " "}`}
              </span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
