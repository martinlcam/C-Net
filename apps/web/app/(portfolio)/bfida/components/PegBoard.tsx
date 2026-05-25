"use client"

import type React from "react"
import { useMemo, useState } from "react"
import type { Board, Jump, Position } from "../lib/boards"
import { BOARD_SIZE } from "../lib/boards"
import { jumpsFrom, positionsEqual } from "../lib/move-logic"

type PegBoardProps = {
  board: Board
  /** When set, the board is read-only and renders the given highlights instead. */
  mode: "play" | "replay"
  /** Optional jump currently being animated (replay mode). */
  activeJump?: Jump | null
  /** When the user clicks a hole. (play mode only) */
  onCellClick?: (p: Position) => void
  /** Selected peg position (play mode). */
  selected?: Position | null
  /** Render hint outline on these holes (e.g. legal destinations from selection). */
  hintDestinations?: Position[]
  /** Optional emphasis on the peg about to jump and its destination (replay mode). */
  emphasizeFrom?: Position | null
  emphasizeTo?: Position | null
  /** Tailwind-applicable className for the wrapper. */
  className?: string
}

const CELL = 56
const RADIUS = 18
const HOLE_RADIUS = 6

export function PegBoard({
  board,
  mode,
  onCellClick,
  selected,
  hintDestinations,
  emphasizeFrom,
  emphasizeTo,
  className,
}: PegBoardProps) {
  const [hovered, setHovered] = useState<Position | null>(null)

  const legalDestinations = useMemo<Position[]>(() => {
    if (mode !== "play" || !selected) return hintDestinations ?? []
    return jumpsFrom(board, selected).map((j) => j.to)
  }, [board, mode, selected, hintDestinations])

  const isLegalDest = (p: Position) =>
    legalDestinations.some((d) => d[0] === p[0] && d[1] === p[1])

  const totalWidth = CELL * BOARD_SIZE
  const totalHeight = CELL * BOARD_SIZE
  const gradientId = `marble-gradient-${board.kind}`

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={`${board.kind} peg solitaire board`}
      >
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#e6d4ff" />
            <stop offset="40%" stopColor="#a17adc" />
            <stop offset="100%" stopColor="#3f2380" />
          </radialGradient>
          <filter id={`shadow-${board.kind}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.45" />
          </filter>
        </defs>

        {board.cells.map((row, r) =>
          row.map((cell, c) => {
            if (cell === "off") return null
            const cx = c * CELL + CELL / 2
            const cy = r * CELL + CELL / 2
            const pos: Position = [r, c]
            const isSelected = selected ? positionsEqual(selected, pos) : false
            const legalDest = isLegalDest(pos)
            const isHover = hovered && positionsEqual(hovered, pos)
            const isEmphasizedFrom = emphasizeFrom && positionsEqual(emphasizeFrom, pos)
            const isEmphasizedTo = emphasizeTo && positionsEqual(emphasizeTo, pos)
            const showRing = isSelected || isEmphasizedFrom
            const showDestinationHalo = (legalDest && cell === "hole") || isEmphasizedTo
            const interactive = mode === "play"

            const handleKey = interactive
              ? (e: React.KeyboardEvent<SVGGElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onCellClick?.(pos)
                  }
                }
              : undefined

            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: r,c are board coordinates, not array indices
              <g
                key={`cell-${r}-${c}`}
                role={interactive ? "button" : "presentation"}
                tabIndex={interactive ? -1 : undefined}
                aria-label={
                  interactive
                    ? `${cell === "peg" ? "Marble" : "Empty hole"} at row ${r + 1}, column ${c + 1}`
                    : undefined
                }
                onClick={interactive ? () => onCellClick?.(pos) : undefined}
                onKeyDown={handleKey}
                onPointerEnter={interactive ? () => setHovered(pos) : undefined}
                onPointerLeave={interactive ? () => setHovered(null) : undefined}
                className={interactive ? "cursor-pointer focus:outline-none" : undefined}
              >
                {/* Invisible full-cell hit target so clicks land anywhere in the square,
                    not just on the small hole ring. fill="transparent" is hit-testable;
                    fill="none" would not be. */}
                <rect
                  x={c * CELL}
                  y={r * CELL}
                  width={CELL}
                  height={CELL}
                  fill="transparent"
                />

                {showDestinationHalo && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={RADIUS + 8}
                    fill="#bea9e9"
                    fillOpacity={0.18}
                    stroke="#bea9e9"
                    strokeWidth={1.5}
                    opacity={0.95}
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={HOLE_RADIUS}
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth={1.25}
                  opacity={cell === "hole" ? 1 : 0.35}
                />

                {cell === "peg" && (
                  <g
                    filter={`url(#shadow-${board.kind})`}
                    className="transition-transform duration-200"
                  >
                    <circle cx={cx} cy={cy} r={RADIUS} fill={`url(#${gradientId})`} />
                    {showRing && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={RADIUS + 3}
                        fill="none"
                        stroke="#bea9e9"
                        strokeWidth={2.25}
                      />
                    )}
                    {isHover && !showRing && interactive && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={RADIUS + 2}
                        fill="none"
                        stroke="#bea9e9"
                        strokeWidth={1.25}
                        opacity={0.7}
                      />
                    )}
                  </g>
                )}
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}
