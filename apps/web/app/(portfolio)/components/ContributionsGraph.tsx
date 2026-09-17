"use client"

import { useQuery } from "@tanstack/react-query"
import { animate, stagger } from "animejs"
import { type PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ContributionDay, Contributions } from "@/app/api/github/contributions/route"
import styles from "./ContributionsGraph.module.css"

/*
 * A GitHub-style contributions calendar filling the hero's bottom-left box:
 * a caption above, an SVG of rounded day blocks with month labels over the
 * columns and weekday labels beside the rows, and a footer with the year's
 * tally and the scale. The blocks are sized to the box, with as many of the
 * newest weeks as fit across it. The data comes from
 * /api/github/contributions and is refreshed every ten minutes; the blocks
 * draw in from the newest day outwards the first time they appear.
 */

const REFRESH_MS = 10 * 60 * 1000
const MAX_WEEKS = 53
const MAX_UNIT = 14
const MIN_UNIT = 9
const LABEL_HEIGHT = 16
const DAY_LABEL_WIDTH = 26
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type Cell = ContributionDay & { row: number; col: number }

/* the date arrives as YYYY-MM-DD; reading it as local midnight keeps the
   weekday GitHub assigned rather than shifting it by the viewer's timezone */
function localDate(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toCells(days: ContributionDay[]): { cells: Cell[]; weeks: number } {
  if (days.length === 0) return { cells: [], weeks: 0 }
  const firstRow = localDate(days[0].date).getDay()
  const cells = days.map((day, i) => ({
    ...day,
    row: (firstRow + i) % 7,
    col: Math.floor((firstRow + i) / 7),
  }))
  return { cells, weeks: cells[cells.length - 1].col + 1 }
}

/* a label over the first week of each month, dropping one that would sit
   within three weeks of the graph's ends */
function monthLabels(cells: Cell[], firstCol: number, cols: number) {
  const labels: { col: number; name: string }[] = []
  let previous = -1
  for (const cell of cells) {
    if (cell.col < firstCol) continue
    const month = localDate(cell.date).getMonth()
    if (month === previous) continue
    previous = month
    labels.push({ col: cell.col - firstCol, name: MONTHS[month] })
  }
  return labels.filter((label, i) => {
    if (i === 0) return labels.length > 1 && labels[1].col - label.col >= 3
    if (i === labels.length - 1) return cols - label.col >= 3
    return true
  })
}

function describe(day: ContributionDay) {
  const d = localDate(day.date)
  const when = `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`
  const what =
    day.count === 0
      ? "No contributions"
      : `${day.count.toLocaleString()} contribution${day.count === 1 ? "" : "s"}`
  return { what, when }
}

async function fetchContributions(): Promise<Contributions> {
  const res = await fetch("/api/github/contributions")
  if (!res.ok) throw new Error(`contributions ${res.status}`)
  return res.json()
}

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

type Props = {
  title: string
}

export function ContributionsGraph({ title }: Props) {
  const { data, isError } = useQuery({
    queryKey: ["github", "contributions"],
    queryFn: fetchContributions,
    staleTime: 5 * 60 * 1000,
    refetchInterval: REFRESH_MS,
    retry: 1,
  })

  const frame = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const { width, height } = useSize(frame)
  const [active, setActive] = useState<Cell | null>(null)
  const [pending, setPending] = useState(true)

  const { cells, weeks } = useMemo(() => toCells(data?.days ?? []), [data])

  // a block plus its gap is one unit; the rows fill the frame's height and
  // as many of the newest weeks as fit fill its width
  const unit = Math.max(MIN_UNIT, Math.min(MAX_UNIT, Math.floor((height - LABEL_HEIGHT) / 7)))
  const margin = unit >= 12 ? 3 : 2
  const block = unit - margin
  const cols = Math.min(weeks, MAX_WEEKS, Math.floor((width - DAY_LABEL_WIDTH + margin) / unit))
  const firstCol = weeks - cols
  const shown = useMemo(() => cells.filter((cell) => cell.col >= firstCol), [cells, firstCol])
  const byPlace = useMemo(
    () => new Map(shown.map((cell) => [`${cell.row}:${cell.col - firstCol}`, cell])),
    [shown, firstCol]
  )
  const months = useMemo(() => monthLabels(cells, firstCol, cols), [cells, firstCol, cols])
  const ready = cols > 0 && height > 0

  useEffect(() => {
    if (!ready || !pending || !svg.current) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPending(false)
      return
    }
    const blocks = svg.current.querySelectorAll(`.${styles.block}`)
    const newest = blocks.length - 1
    const animation = animate(blocks, {
      opacity: [0, 1],
      scale: [0, 1],
      ease: "outBack",
      duration: 500,
      delay: stagger(5, { from: newest, reversed: true }),
      onComplete: () => setPending(false),
    })
    return () => {
      animation.cancel()
    }
  }, [ready, pending])

  // one listener on the calendar finds the block under the pointer, so the
  // whole unit around a block, gap included, is its hit target
  const track = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const col = Math.floor((event.clientX - bounds.left - DAY_LABEL_WIDTH) / unit)
    const row = Math.floor((event.clientY - bounds.top - LABEL_HEIGHT) / unit)
    setActive(byPlace.get(`${row}:${col}`) ?? null)
  }

  const tip = active ? describe(active) : null
  const tipX = active ? DAY_LABEL_WIDTH + (active.col - firstCol) * unit + block / 2 : 0
  const tipY = active ? LABEL_HEIGHT + active.row * unit : 0
  // the tooltip hangs under the top rows and floats above the rest
  const tipBelow = active !== null && active.row < 2

  return (
    <div className={styles.root}>
      <p className={styles.title}>{title}</p>

      <div ref={frame} className={styles.frame} onPointerLeave={() => setActive(null)}>
        {ready && (
          <svg
            ref={svg}
            className={`${styles.calendar} ${pending ? styles.pending : ""}`}
            width={DAY_LABEL_WIDTH + cols * unit - margin}
            height={LABEL_HEIGHT + 7 * unit - margin}
            aria-label={`GitHub contributions, ${data?.total.toLocaleString()} in the last year`}
            onPointerMove={track}
          >
            <title>GitHub contributions</title>
            <g className={styles.labels}>
              {months.map((month) => (
                <text key={month.col} x={DAY_LABEL_WIDTH + month.col * unit} y={0}>
                  {month.name}
                </text>
              ))}
              {[1, 3, 5].map((row) => (
                <text key={row} x={0} y={LABEL_HEIGHT + row * unit + block / 2 + 3}>
                  {WEEKDAYS[row]}
                </text>
              ))}
            </g>
            {shown.map((cell) => (
              <rect
                key={cell.date}
                className={styles.block}
                data-level={cell.level}
                data-active={cell === active || undefined}
                x={DAY_LABEL_WIDTH + (cell.col - firstCol) * unit}
                y={LABEL_HEIGHT + cell.row * unit}
                width={block}
                height={block}
                rx={2}
                ry={2}
              >
                <title>{`${describe(cell).what} on ${describe(cell).when}`}</title>
              </rect>
            ))}
          </svg>
        )}
        {active && tip && (
          <div
            className={styles.tip}
            data-below={tipBelow || undefined}
            role="tooltip"
            style={{ left: tipX, top: tipBelow ? tipY + block + 6 : tipY - 6 }}
          >
            <strong>{tip.what}</strong>
            <span>{tip.when}</span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.total}>
          {data
            ? `${data.total.toLocaleString()} contributions in the last year`
            : isError
              ? "GitHub is out of reach"
              : " "}
        </p>
        <p className={styles.legend} aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <svg key={level} width={10} height={10}>
              <title>{`Level ${level}`}</title>
              <rect
                className={styles.block}
                data-level={level}
                width={10}
                height={10}
                rx={2}
                ry={2}
              />
            </svg>
          ))}
          <span>More</span>
        </p>
      </div>
    </div>
  )
}
