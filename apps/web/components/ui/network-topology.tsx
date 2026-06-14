"use client"

import { motion, useReducedMotion } from "framer-motion"
import * as React from "react"

/**
 * A responsive, schematic network-topology renderer.
 *
 * Why this exists instead of a generic node graph: it renders as a single
 * `viewBox` SVG so it scales to whatever container holds it (never clipped),
 * and every label lives *inside* its pill — so labels can never collide with
 * other nodes the way externally-positioned labels do.
 *
 * Two trace kinds carry meaning:
 *   • data    — solid hairline with a travelling pulse (live request / pub-sub)
 *   • control — dashed, static (CI / deploy control plane)
 */

type Side = "left" | "right" | "top" | "bottom"

type TopoNode = {
  id: string
  label: string
  /** secondary text rendered dimmer, e.g. a port */
  sub?: string
  icon?: React.ReactElement
  /** centre of the pill in viewBox units */
  x: number
  y: number
  /** accent the node (e.g. a hub) with the theme colour */
  accent?: boolean
}

type TopoEdge = {
  from: string
  to: string
  kind?: "data" | "control"
  bidirectional?: boolean
  /** force the exit/entry sides instead of auto-picking by dominant axis */
  fromSide?: Side
  toSide?: Side
  /** orthogonal guide points the trace must pass through (viewBox units) */
  waypoints?: Array<{ x: number; y: number }>
}

type TopoGroup = {
  id: string
  label?: string
  x: number
  y: number
  width: number
  height: number
  accent?: boolean
}

type NetworkTopologyProps = {
  nodes: TopoNode[]
  edges: TopoEdge[]
  groups?: TopoGroup[]
  /** viewBox dimensions; the SVG itself fills 100% of its parent's width */
  width?: number
  height?: number
  className?: string
  accentColor?: string
  showGrid?: boolean
  pulseSpeed?: number
}

const PILL_H = 32
const FONT = 6.7 // approx advance per char at 11.5px
const ICON = 15

const INK = "rgba(20, 18, 24, 0.82)"
const INK_SOFT = "rgba(20, 18, 24, 0.5)"
const TRACE = "rgba(20, 18, 24, 0.32)"
const CONTROL = "rgba(20, 18, 24, 0.26)"

function pillWidth(n: TopoNode) {
  const text = n.sub ? `${n.label}  ${n.sub}` : n.label
  const iconW = n.icon ? ICON + 7 : 0
  return Math.max(72, Math.round(iconW + text.length * FONT + 26))
}

export function NetworkTopology({
  nodes,
  edges,
  groups,
  width = 740,
  height = 470,
  className,
  accentColor = "#ad70eb",
  showGrid = true,
  pulseSpeed = 3.2,
}: NetworkTopologyProps) {
  const reduce = useReducedMotion()

  const layout = React.useMemo(() => {
    const map = new Map<string, TopoNode & { w: number; h: number }>()
    for (const n of nodes) map.set(n.id, { ...n, w: pillWidth(n), h: PILL_H })
    return map
  }, [nodes])

  const anchor = React.useCallback(
    (id: string, side: Side) => {
      const n = layout.get(id)
      if (!n) return { x: 0, y: 0 }
      const hx = n.w / 2
      const hy = n.h / 2
      switch (side) {
        case "left":
          return { x: n.x - hx, y: n.y }
        case "right":
          return { x: n.x + hx, y: n.y }
        case "top":
          return { x: n.x, y: n.y - hy }
        case "bottom":
          return { x: n.x, y: n.y + hy }
      }
    },
    [layout]
  )

  const buildPath = React.useCallback(
    (edge: TopoEdge) => {
      const from = layout.get(edge.from)
      const to = layout.get(edge.to)
      if (!from || !to) return ""

      const dx = to.x - from.x
      const dy = to.y - from.y
      const horizontal = Math.abs(dx) >= Math.abs(dy)

      const fromSide: Side =
        edge.fromSide ?? (horizontal ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top")
      const toSide: Side =
        edge.toSide ?? (horizontal ? (dx > 0 ? "left" : "right") : dy > 0 ? "top" : "bottom")

      const start = anchor(edge.from, fromSide)
      const end = anchor(edge.to, toSide)

      const pts: Array<{ x: number; y: number }> = [start]
      if (edge.waypoints && edge.waypoints.length > 0) {
        pts.push(...edge.waypoints)
      } else if (horizontal) {
        const midX = (start.x + end.x) / 2
        pts.push({ x: midX, y: start.y }, { x: midX, y: end.y })
      } else {
        const midY = (start.y + end.y) / 2
        pts.push({ x: start.x, y: midY }, { x: end.x, y: midY })
      }
      pts.push(end)

      return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
    },
    [anchor, layout]
  )

  return (
    <div className={className} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label="Deployment network topology"
      >
        <defs>
          <filter id="topo-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {showGrid && (
            <pattern id="topo-grid" width={22} height={22} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.7} fill="rgba(20,18,24,0.10)" />
            </pattern>
          )}
        </defs>

        {showGrid && <rect width={width} height={height} fill="url(#topo-grid)" />}

        {/* Boundary boxes — infrastructure, drawn behind everything */}
        {groups?.map((g) => (
          <g key={`g-${g.id}`}>
            <rect
              x={g.x}
              y={g.y}
              width={g.width}
              height={g.height}
              rx={13}
              fill={g.accent ? "rgba(173,112,235,0.035)" : "rgba(20,18,24,0.018)"}
              stroke={g.accent ? "rgba(173,112,235,0.4)" : "rgba(20,18,24,0.16)"}
              strokeWidth={1}
            />
            {g.label && (
              <text
                x={g.x + 15}
                y={g.y + 19}
                fill={g.accent ? "rgba(173,112,235,0.85)" : INK_SOFT}
                fontFamily="ui-monospace, monospace"
                fontSize={9}
                letterSpacing="0.18em"
                fontWeight={600}
              >
                {g.label.toUpperCase()}
              </text>
            )}
          </g>
        ))}

        {/* Traces */}
        {edges.map((edge, i) => {
          const d = buildPath(edge)
          if (!d) return null
          const control = edge.kind === "control"
          return (
            <g key={`e-${edge.from}-${edge.to}`}>
              <path
                d={d}
                fill="none"
                stroke={control ? CONTROL : TRACE}
                strokeWidth={control ? 1 : 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={control ? "4 4" : undefined}
              />
              {!control && !reduce && (
                <motion.path
                  d={d}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#topo-glow)"
                  pathLength={1}
                  strokeDasharray="0.14 0.86"
                  initial={{ strokeDashoffset: 1 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: pulseSpeed,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                    delay: i * 0.22,
                  }}
                />
              )}
              {!control && edge.bidirectional && !reduce && (
                <motion.path
                  d={d}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#topo-glow)"
                  pathLength={1}
                  strokeDasharray="0.14 0.86"
                  initial={{ strokeDashoffset: -1 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: pulseSpeed,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                    delay: i * 0.22 + pulseSpeed / 2,
                  }}
                />
              )}
            </g>
          )
        })}

        {/* Pill nodes */}
        {nodes.map((n, i) => {
          const node = layout.get(n.id)
          if (!node) return null
          const stroke = n.accent ? accentColor : INK
          const x = n.x - node.w / 2
          const y = n.y - node.h / 2
          const iconX = x + 12
          const textX = n.icon ? iconX + ICON + 7 : x + 13
          return (
            <motion.g
              key={`n-${n.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.4 }}
            >
              <rect
                x={x}
                y={y}
                width={node.w}
                height={node.h}
                rx={7}
                fill={n.accent ? "rgba(173,112,235,0.08)" : "#faf6f1"}
                stroke={stroke}
                strokeWidth={1.25}
              />
              {n.icon && (
                <g transform={`translate(${iconX} ${n.y - ICON / 2})`} style={{ color: stroke }}>
                  {React.cloneElement(n.icon, {
                    width: ICON,
                    height: ICON,
                    className: "",
                  } as Record<string, unknown>)}
                </g>
              )}
              <text
                x={textX}
                y={n.y + 4}
                fontFamily="ui-monospace, monospace"
                fontSize={11.5}
                fill={n.accent ? accentColor : INK}
                fontWeight={500}
              >
                {n.label}
                {n.sub && (
                  <tspan fill={INK_SOFT} fontWeight={400}>
                    {"  "}
                    {n.sub}
                  </tspan>
                )}
              </text>
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}

export type { TopoNode, TopoEdge, TopoGroup, NetworkTopologyProps }
