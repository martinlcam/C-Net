import { describe, expect, it } from "bun:test"
import {
  DEFAULT_CALIBRATION,
  deviceOrientationMatrix,
  findInstaOffset,
  insvProxyName,
  lensSample,
  panoramaLayout,
  parseInstaOffset,
  rayFor,
  seamWeight,
  viewMatrix,
} from "./panorama"

const X4_OFFSET =
  "2_2889.695_4004.480_2988.990_-0.222_0.166_90.054_2889.406_11996.670_3006.900_0.278_0.271_90.065_16000_6000_10958"

function close(a: number[], b: number[], digits = 6) {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], digits)
}

describe("panoramaLayout", () => {
  it("recognises Insta360 proxies and photos by extension, case-insensitively", () => {
    expect(panoramaLayout("LRV_20260506_115652_01_030.lrv")).toBe("dual-fisheye")
    expect(panoramaLayout("IMG_20260227_193318_00_049.INSP")).toBe("dual-fisheye")
  })

  it("leaves ordinary media and the unplayable 8K originals alone", () => {
    expect(panoramaLayout("clip.mp4")).toBeNull()
    expect(panoramaLayout("photo.jpg")).toBeNull()
    expect(panoramaLayout("VID_20260506_115652_00_030.insv")).toBeNull()
  })
})

describe("insvProxyName", () => {
  it("maps an 8K original to the name of its low-res proxy", () => {
    expect(insvProxyName("VID_20260506_115652_00_030.insv")).toBe("LRV_20260506_115652_01_030.lrv")
  })

  it("returns null for anything that is not an original", () => {
    expect(insvProxyName("LRV_20260506_115652_01_030.lrv")).toBeNull()
    expect(insvProxyName("holiday.insv")).toBeNull()
  })
})

describe("parseInstaOffset", () => {
  it("normalises the X4 calibration into per-lens square coordinates", () => {
    const cal = parseInstaOffset(X4_OFFSET)
    if (!cal) throw new Error("the X4 string did not parse")
    const [a, b] = cal.lenses
    // r90 is the pixel radius of the 90° ring; the square crop is 6000 px tall, so 3000 = 1.
    expect(a.r90).toBeCloseTo(2889.695 / 3000, 6)
    expect(b.r90).toBeCloseTo(2889.406 / 3000, 6)
    // Lens 0 centre sits 4.48 px right and 11.01 px above the 8000x6000 sensor centre.
    expect(a.cx).toBeCloseTo(4.48 / 3000, 6)
    expect(a.cy).toBeCloseTo(-11.01 / 3000, 6)
    // Lens 1 lives in the second 8000 px sensor.
    expect(b.cx).toBeCloseTo((11996.67 - 12000) / 3000, 6)
    expect(b.cy).toBeCloseTo(6.9 / 3000, 6)
  })

  it("rejects strings that are not a two-lens calibration", () => {
    expect(parseInstaOffset("")).toBeNull()
    expect(parseInstaOffset("2_1_2_3")).toBeNull()
    expect(parseInstaOffset("2_10_4004_2988_0_0_90_10_11996_3006_0_0_90_16000_6000")).toBeNull()
  })

  it("ships a default that matches the X4 string", () => {
    const cal = parseInstaOffset(X4_OFFSET)
    if (!cal) throw new Error("the X4 string did not parse")
    close(
      [DEFAULT_CALIBRATION.lenses[0].r90, DEFAULT_CALIBRATION.lenses[1].r90],
      [cal.lenses[0].r90, cal.lenses[1].r90],
      4
    )
  })
})

describe("findInstaOffset", () => {
  it("pulls the calibration string out of the binary tail of a file", () => {
    const junk = new Uint8Array([0, 1, 2, 0xff, 0xfe])
    const text = new TextEncoder().encode(
      `Insta360 X4\u0000v1.5.3_build4*o${X4_OFFSET}\u0000\u0000`
    )
    const bytes = new Uint8Array([...junk, ...text, ...junk])
    expect(findInstaOffset(bytes)).toBe(X4_OFFSET)
  })

  it("returns null when there is no calibration in the bytes", () => {
    expect(findInstaOffset(new TextEncoder().encode("moov mdat 1_2_3"))).toBeNull()
  })
})

describe("viewMatrix and rayFor", () => {
  const w = 800
  const h = 400
  const fov = Math.PI / 2

  it("looks straight ahead at the centre pixel with no rotation", () => {
    close(rayFor(w / 2, h / 2, w, h, viewMatrix(0, 0), fov), [0, 0, 1])
  })

  it("turns right with positive yaw and up with positive pitch", () => {
    close(rayFor(w / 2, h / 2, w, h, viewMatrix(Math.PI / 2, 0), fov), [1, 0, 0])
    close(rayFor(w / 2, h / 2, w, h, viewMatrix(0, Math.PI / 2), fov), [0, 1, 0])
  })

  it("spreads the horizontal field of view across the width", () => {
    const left = rayFor(0, h / 2, w, h, viewMatrix(0, 0), fov)
    const right = rayFor(w, h / 2, w, h, viewMatrix(0, 0), fov)
    expect(Math.atan2(left[0], left[2])).toBeCloseTo(-fov / 2, 6)
    expect(Math.atan2(right[0], right[2])).toBeCloseTo(fov / 2, 6)
    const top = rayFor(w / 2, 0, w, h, viewMatrix(0, 0), fov)
    expect(top[1]).toBeGreaterThan(0)
  })
})

describe("lensSample", () => {
  const cal = DEFAULT_CALIBRATION
  const r = cal.lenses[0].r90

  it("maps forward to the middle of the left circle and backward to the right one", () => {
    const f = lensSample([0, 0, 1], cal)
    expect(f.lens).toBe(0)
    expect(f.u).toBeCloseTo(0.25 + cal.lenses[0].cx * 0.25, 6)
    expect(f.v).toBeCloseTo(0.5 + cal.lenses[0].cy * 0.5, 6)
    const b = lensSample([0, 0, -1], cal)
    expect(b.lens).toBe(1)
    expect(b.u).toBeCloseTo(0.75 + cal.lenses[1].cx * 0.25, 6)
  })

  it("puts straight up at the top of the circle, 90° out on the ring", () => {
    const up = lensSample([0, 1, 0], cal)
    expect(up.v).toBeCloseTo(0.5 + (cal.lenses[0].cy - r) * 0.5, 6)
    expect(up.u).toBeCloseTo(0.25 + cal.lenses[0].cx * 0.25, 6)
  })

  it("keeps the seam continuous: just-ahead-right and just-behind-right touch at the frame middle", () => {
    const ahead = lensSample([1, 0, 1e-6], cal)
    const behind = lensSample([1, 0, -1e-6], cal)
    expect(ahead.lens).toBe(0)
    expect(behind.lens).toBe(1)
    expect(ahead.u).toBeCloseTo(0.25 * (1 + cal.lenses[0].cx + r), 5)
    expect(behind.u).toBeCloseTo(0.5 + 0.25 * (1 + cal.lenses[1].cx - cal.lenses[1].r90), 5)
    // Both land on their circle's horizontal midline.
    expect(ahead.v).toBeCloseTo(0.5 + 0.5 * cal.lenses[0].cy, 6)
    expect(behind.v).toBeCloseTo(0.5 + 0.5 * cal.lenses[1].cy, 6)
  })

  it("lets the caller sample a specific lens past the 90° ring for blending", () => {
    const s = lensSample([1, 0, -0.02], cal, 0)
    expect(s.lens).toBe(0)
    expect(s.u).toBeGreaterThan(0.25 * (1 + cal.lenses[0].cx + r))
  })
})

describe("seamWeight", () => {
  it("is fully lens 0 ahead, fully lens 1 behind, and half on the seam", () => {
    expect(seamWeight([0, 0, 1], 0.05)).toBe(1)
    expect(seamWeight([0, 0, -1], 0.05)).toBe(0)
    expect(seamWeight([1, 0, 0], 0.05)).toBeCloseTo(0.5, 6)
  })

  it("ramps smoothly across the blend band", () => {
    const a = seamWeight([1, 0, 0.01], 0.05)
    const b = seamWeight([1, 0, 0.03], 0.05)
    expect(a).toBeGreaterThan(0.5)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(1)
  })
})

describe("deviceOrientationMatrix", () => {
  const forward = (m: number[]) => [m[6], m[7], m[8]]

  it("looks at the horizon when the phone is held upright in portrait", () => {
    close(forward(deviceOrientationMatrix(0, 90, 0, 0)), [0, 0, 1], 5)
  })

  it("looks at the floor when the phone lies flat with the screen up", () => {
    close(forward(deviceOrientationMatrix(0, 0, 0, 0)), [0, -1, 0], 5)
  })

  it("turning the phone to the left pans the view to the left", () => {
    // alpha grows counter-clockwise seen from above, i.e. turning left.
    const f = forward(deviceOrientationMatrix(90, 90, 0, 0))
    expect(f[0]).toBeCloseTo(-1, 5)
    expect(Math.abs(f[1])).toBeLessThan(1e-5)
  })

  it("keeps the horizon level when the screen rotates to landscape", () => {
    // Phone upright, rotated 90° to landscape: the view should still face the horizon.
    const f = forward(deviceOrientationMatrix(0, 90, 0, 90))
    expect(Math.abs(f[1])).toBeLessThan(1e-5)
  })
})
