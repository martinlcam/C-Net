"use client"

import { createTimeline, stagger, svg } from "animejs"
import { type RefObject, useEffect } from "react"

type Options = {
  /* which shapes under the element to draw; anime can trace paths, lines,
     polylines and rects */
  selector?: string
  duration?: number
  /* the pause between one shape starting and the next */
  gap?: number
  /* for filled drawings: once traced, fill the ink and fade the outline */
  fill?: boolean
}

/*
 * Draws the svg shapes under an element in: each stroke is traced along its
 * length, one after another. The stylesheet is expected to hide the strokes
 * (stroke-opacity 0) until this runs, and to show the shapes whole for
 * readers who prefer less motion, for whom this does nothing.
 */
export function useDrawIn(
  ref: RefObject<HTMLElement | null>,
  {
    selector = "path, line, polyline, rect",
    duration = 2200,
    gap = 250,
    fill = false,
  }: Options = {}
) {
  useEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const shapes = Array.from(root.querySelectorAll<SVGGeometryElement>(selector))
    if (shapes.length === 0) return

    const timeline = createTimeline()
      .add(shapes, { strokeOpacity: 1, duration: 0 })
      .add(svg.createDrawable(shapes), {
        draw: ["0 0", "0 1"],
        ease: "inOutQuad",
        duration,
        delay: stagger(gap),
      })
    if (fill) {
      timeline.add(
        shapes,
        { fillOpacity: 1, strokeOpacity: 0, ease: "linear", duration: 700 },
        "-=300"
      )
    }

    return () => {
      timeline.revert()
    }
  }, [ref, selector, duration, gap, fill])
}
