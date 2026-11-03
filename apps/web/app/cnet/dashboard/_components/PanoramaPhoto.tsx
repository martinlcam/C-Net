"use client"

import { useRef, useState } from "react"
import {
  PanoramaToolbar,
  PanoramaView,
  type PanoramaViewHandle,
  useGyroSupport,
} from "./PanoramaView"
import { type Calibration, DEFAULT_CALIBRATION } from "./panorama"

/** A 360 still (Insta360 .insp): the same stitch as video, drawn once from an image. */
export function PanoramaPhoto({
  url,
  calibration = DEFAULT_CALIBRATION,
}: {
  url: string
  calibration?: Calibration
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const panoRef = useRef<PanoramaViewHandle>(null)
  const [gyro, setGyro] = useState(false)
  const [failed, setFailed] = useState(false)
  const gyroSupported = useGyroSupport()

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Kept in the DOM (not display:none) so every browser decodes it for the GPU upload. */}
      {/* biome-ignore lint/performance/noImgElement: signed cross-origin URL feeding WebGL */}
      <img
        ref={imgRef}
        src={url}
        alt=""
        crossOrigin="anonymous"
        onError={() => setFailed(true)}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      <PanoramaView
        ref={panoRef}
        sourceRef={imgRef}
        live={false}
        calibration={calibration}
        onGyroChange={setGyro}
      />
      {failed ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">
          The photo could not be loaded.
        </p>
      ) : null}
      <PanoramaToolbar
        className="absolute right-3 bottom-3"
        onRecenter={() => panoRef.current?.recenter()}
        gyro={gyro}
        gyroSupported={gyroSupported}
        onToggleGyro={() => panoRef.current?.setGyro(!gyro)}
      />
    </div>
  )
}
