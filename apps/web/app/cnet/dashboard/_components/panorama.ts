// Geometry for Insta360 dual-fisheye files (.lrv proxies and .insp photos). The camera stores
// its two lenses side by side as upright circles, lens 0 on the left looking forward and lens 1
// on the right looking backward, so that the inner edges of the circles meet at the seam.
// Everything here is pure so the shader in panorama-gl.ts and the tests share one definition.
//
// Conventions: directions are [x, y, z] with x right, y up, z forward (lens 0's axis). Texture
// coordinates are [u, v] over the whole frame with v = 0 at the top. Matrices are 3x3 column-major
// (the layout WebGL's uniformMatrix3fv wants) and map camera space to world space.

export type Vec3 = [number, number, number]
export type Mat3 = number[]

export type LensCalibration = {
  /** Circle centre offset from the middle of the lens's square, in half-square units. */
  cx: number
  cy: number
  /** Radius of the 90° ring, in half-square units (1 = the ring touches the square's edge). */
  r90: number
}

export type Calibration = { lenses: [LensCalibration, LensCalibration] }

/** Measured from an Insta360 X4; every file from one camera carries the same numbers. */
export const DEFAULT_CALIBRATION: Calibration = {
  lenses: [
    { cx: 0.0015, cy: -0.0037, r90: 0.9632 },
    { cx: -0.0011, cy: 0.0023, r90: 0.9631 },
  ],
}

export type PanoramaLayout = "dual-fisheye"

function ext(filename: string): string {
  const lower = filename.toLowerCase()
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : ""
}

/** Files the 360 viewer can show. The 8K .insv originals are HEVC and never play in a browser. */
export function panoramaLayout(filename: string): PanoramaLayout | null {
  const e = ext(filename)
  return e === ".lrv" || e === ".insp" ? "dual-fisheye" : null
}

/** The low-res proxy the camera writes next to an 8K original: VID_x_00_n.insv → LRV_x_01_n.lrv. */
export function insvProxyName(filename: string): string | null {
  const m = /^VID_(\d{8}_\d{6})_00_(\d+)\.insv$/i.exec(filename)
  return m ? `LRV_${m[1]}_01_${m[2]}.lrv` : null
}

// Version, then per lens (r90, cx, cy, rotX, rotY, rotZ), then the calibration frame size,
// e.g. 2_2889.695_4004.480_2988.990_-0.222_0.166_90.054_2889.406_11996.670_3006.900_..._16000_6000.
const OFFSET_RE = /\d+(?:_-?\d+\.\d+){12}(?:_\d+)+/

/** Find the camera's calibration string in raw file bytes (it sits in the trailer of every file). */
export function findInstaOffset(bytes: Uint8Array): string | null {
  const text = new TextDecoder("latin1").decode(bytes)
  const m = OFFSET_RE.exec(text)
  return m ? m[0] : null
}

/**
 * Turn the calibration string into per-lens square coordinates. The numbers are pixels in a
 * frame made of the two sensors side by side (W/2 by H each); the camera keeps the centred
 * H by H square of each sensor, which is what the proxies and photos contain.
 */
export function parseInstaOffset(text: string): Calibration | null {
  const t = text.split("_").map(Number)
  if (t.length < 15 || t.some((n) => !Number.isFinite(n))) return null
  const width = t[13]
  const height = t[14]
  if (width <= 0 || height <= 0 || width < 2 * height) return null
  const sensorWidth = width / 2
  const cropX = (sensorWidth - height) / 2
  const half = height / 2

  const lens = (i: number): LensCalibration | null => {
    const base = 1 + i * 6
    const r90 = t[base] / half
    const cx = (t[base + 1] - i * sensorWidth - cropX - half) / half
    const cy = (t[base + 2] - half) / half
    if (r90 < 0.6 || r90 > 1.4 || Math.abs(cx) > 0.2 || Math.abs(cy) > 0.2) return null
    return { cx, cy, r90 }
  }
  const a = lens(0)
  const b = lens(1)
  return a && b ? { lenses: [a, b] } : null
}

/** Column-major 3x3 product a * b. */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = new Array(9).fill(0)
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      out[col * 3 + row] =
        a[row] * b[col * 3] + a[3 + row] * b[col * 3 + 1] + a[6 + row] * b[col * 3 + 2]
    }
  }
  return out
}

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ]
}

function rotX(a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [1, 0, 0, 0, c, s, 0, -s, c]
}

function rotY(a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [c, 0, -s, 0, 1, 0, s, 0, c]
}

function rotZ(a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [c, s, 0, -s, c, 0, 0, 0, 1]
}

/** Mouse/touch view: positive yaw turns right, positive pitch looks up. */
export function viewMatrix(yaw: number, pitch: number): Mat3 {
  return multiply(rotY(yaw), rotX(-pitch))
}

const DEG = Math.PI / 180

// Earth frame (x east, y north, z up) to our frame (x east, y up, z north).
const EARTH_TO_VIEW: Mat3 = [1, 0, 0, 0, 0, 1, 0, 1, 0]
// The rear camera looks out of the back of the phone (-z of the device frame), with the
// screen's up along device +y; this maps our camera space onto the device frame.
const CAMERA_TO_DEVICE: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, -1]

/**
 * Camera-to-world matrix for a phone held at the given DeviceOrientation angles (degrees) and
 * screen rotation (0, 90, 180, 270). Earth-to-device is the W3C Z-X'-Y'' rotation; the screen
 * rotation re-expresses our camera axes in the physical device frame.
 */
export function deviceOrientationMatrix(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number
): Mat3 {
  const deviceToEarth = multiply(multiply(rotZ(alpha * DEG), rotX(beta * DEG)), rotY(gamma * DEG))
  const screenToDevice = multiply(rotZ(screenAngle * DEG), CAMERA_TO_DEVICE)
  return multiply(EARTH_TO_VIEW, multiply(deviceToEarth, screenToDevice))
}

/** World direction seen through pixel (x, y) of a width-by-height view with a horizontal fov. */
export function rayFor(
  x: number,
  y: number,
  width: number,
  height: number,
  view: Mat3,
  fov: number
): Vec3 {
  const tanHalf = Math.tan(fov / 2)
  const nx = ((2 * x) / width - 1) * tanHalf
  const ny = (1 - (2 * y) / height) * tanHalf * (height / width)
  const len = Math.hypot(nx, ny, 1)
  return apply(view, [nx / len, ny / len, 1 / len])
}

export type LensSample = { lens: 0 | 1; u: number; v: number }

/**
 * Where a world direction lands in the frame. Picks the lens facing the direction unless one is
 * forced (used to sample both sides of the seam for blending). Equidistant projection: the
 * distance from the circle centre grows linearly with the angle off the lens axis.
 */
export function lensSample(dir: Vec3, cal: Calibration, forceLens?: 0 | 1): LensSample {
  const lens: 0 | 1 = forceLens ?? (dir[2] >= 0 ? 0 : 1)
  const { cx, cy, r90 } = cal.lenses[lens]
  const z = lens === 0 ? dir[2] : -dir[2]
  const px = lens === 0 ? dir[0] : -dir[0]
  const py = -dir[1]
  const theta = Math.acos(Math.max(-1, Math.min(1, z)))
  const rho = r90 * (theta / (Math.PI / 2))
  const planar = Math.hypot(px, py)
  const sx = planar > 0 ? (px / planar) * rho : 0
  const sy = planar > 0 ? (py / planar) * rho : 0
  return {
    lens,
    u: lens * 0.5 + 0.25 * (1 + cx + sx),
    v: 0.5 * (1 + cy + sy),
  }
}

/** Share of lens 0 in the final colour: 1 ahead, 0 behind, a smooth ramp `blend` radians wide. */
export function seamWeight(dir: Vec3, blend: number): number {
  const edge = Math.sin(blend)
  const t = Math.max(0, Math.min(1, (dir[2] + edge) / (2 * edge)))
  return t * t * (3 - 2 * t)
}

/** Widest usable blend band: how far past 90° both circles still hold picture. */
export function blendAngle(cal: Calibration): number {
  const reach = Math.min(1 / cal.lenses[0].r90, 1 / cal.lenses[1].r90) * (Math.PI / 2)
  return Math.min(2.5 * DEG, 0.8 * (reach - Math.PI / 2))
}
