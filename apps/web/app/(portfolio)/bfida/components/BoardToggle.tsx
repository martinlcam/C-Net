"use client"

import type { BoardKind } from "../lib/boards"

type BoardToggleProps = {
  value: BoardKind
  onChange: (kind: BoardKind) => void
  className?: string
}

const OPTIONS: { id: BoardKind; label: string; sub: string }[] = [
  { id: "english", label: "English", sub: "33 holes" },
  { id: "european", label: "European", sub: "37 holes" },
]

export function BoardToggle({ value, onChange, className }: BoardToggleProps) {
  return (
    <div
      className={`inline-flex p-1 rounded-xl border border-black bg-white ${className ?? ""}`}
      role="tablist"
      aria-label="Board selection"
    >
      {OPTIONS.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex flex-col items-center leading-tight ${
              active ? "bg-black text-white" : "bg-transparent text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span>{opt.label}</span>
            <span className={`text-[10px] ${active ? "text-gray-300" : "text-gray-500"}`}>
              {opt.sub}
            </span>
          </button>
        )
      })}
    </div>
  )
}
