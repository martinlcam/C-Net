"use client"

import { type RefObject, useEffect } from "react"

/*
 * Sets a custom property on the element to the length of one device pixel, so
 * hairlines sized with it never smear over two pixels at a fractional zoom or
 * display scale. Chrome lays out in 1/64 css px, so the value is rounded up to
 * that; the line stays at least a whole pixel. Follows zoom and display changes.
 */
export function useDevicePixel(ref: RefObject<HTMLElement | null>, property: string) {
  useEffect(() => {
    let media: MediaQueryList | undefined

    const apply = () => {
      const dpr = window.devicePixelRatio || 1
      ref.current?.style.setProperty(property, `${Math.ceil(64 / dpr) / 64}px`)

      // the query stops matching when the zoom or the display changes
      media?.removeEventListener("change", apply)
      media = window.matchMedia(`(resolution: ${dpr}dppx)`)
      media.addEventListener("change", apply)
    }

    apply()
    return () => media?.removeEventListener("change", apply)
  }, [ref, property])
}
