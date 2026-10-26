import { describe, expect, it } from "bun:test"
import {
  appendFrame,
  batteryModel,
  dialAngle,
  diffGuestEvents,
  type LiveFrame,
  type LiveGuest,
  type LiveUps,
  netRate,
} from "./live"

const guest = (over: Partial<LiveGuest> = {}): LiveGuest => ({
  vmid: 112,
  name: "jellyfin",
  type: "lxc",
  status: "running",
  cpu: 0.1,
  mem: 1,
  maxmem: 2,
  netin: 1000,
  netout: 500,
  uptimeSeconds: 10,
  ...over,
})
const frame = (ts: number, guests: LiveGuest[], ups: LiveUps | null = null): LiveFrame => ({
  t: "host",
  ts,
  node: { cpu: 0.2, mem: 1, maxmem: 2, uptimeSeconds: 100 },
  guests,
  ups,
})

describe("diffGuestEvents", () => {
  it("reports status changes, appearances and disappearances with the frame time", () => {
    const prev = frame(1000, [guest(), guest({ vmid: 113, name: "arr" })])
    const next = frame(3000, [guest({ status: "stopped" }), guest({ vmid: 114, name: "new" })])
    expect(diffGuestEvents(prev, next)).toEqual([
      { ts: 3000, vmid: 112, name: "jellyfin", kind: "status", from: "running", to: "stopped" },
      { ts: 3000, vmid: 113, name: "arr", kind: "gone" },
      { ts: 3000, vmid: 114, name: "new", kind: "appeared" },
    ])
  })
  it("is empty when nothing changed", () => {
    expect(diffGuestEvents(frame(1, [guest()]), frame(2, [guest()]))).toEqual([])
  })
})

describe("appendFrame", () => {
  it("keeps the newest frames in order and drops the oldest past the limit", () => {
    const buf = [frame(1, []), frame(2, [])]
    expect(appendFrame(buf, frame(3, []), 2).map((f) => f.ts)).toEqual([2, 3])
  })
  it("ignores a frame older than the newest one it already has", () => {
    const buf = [frame(5, [])]
    expect(appendFrame(buf, frame(4, []), 10).map((f) => f.ts)).toEqual([5])
  })
})

describe("netRate", () => {
  it("turns two cumulative counters into bytes per second", () => {
    const a = frame(1000, [guest({ netin: 1000, netout: 0 })])
    const b = frame(3000, [guest({ netin: 5000, netout: 2000 })])
    expect(netRate(a, b, 112)).toEqual({ inBps: 2000, outBps: 1000 })
  })
  it("treats a counter reset as zero rather than negative", () => {
    const a = frame(1000, [guest({ netin: 5000, netout: 0 })])
    const b = frame(2000, [guest({ netin: 100, netout: 0 })])
    expect(netRate(a, b, 112)).toEqual({ inBps: 0, outBps: 0 })
  })
})

describe("batteryModel", () => {
  const ups = (over: Partial<LiveUps> = {}): LiveUps => ({
    status: ["OL"],
    onBattery: false,
    lowBattery: false,
    chargePercent: 100,
    runtimeSeconds: 3600,
    loadPercent: 17,
    loadWatts: 153,
    nominalWatts: 900,
    inputVoltage: 115,
    ...over,
  })
  it("is full and resting on mains at 100%", () => {
    expect(batteryModel(ups(), [])).toMatchObject({ fill: 100, mode: "full" })
  })
  it("is charging on mains below 100%", () => {
    expect(batteryModel(ups({ chargePercent: 80 }), [])).toMatchObject({
      fill: 80,
      mode: "charging",
    })
  })
  it("is draining on battery and estimates the drain from recent frames", () => {
    const history = [
      frame(0, [], ups({ onBattery: true, chargePercent: 90 })),
      frame(60_000, [], ups({ onBattery: true, chargePercent: 87 })),
    ]
    const m = batteryModel(
      ups({ onBattery: true, chargePercent: 84, runtimeSeconds: 1500 }),
      history
    )
    expect(m.mode).toBe("draining")
    expect(m.fill).toBe(84)
    expect(m.drainPercentPerMinute).toBeCloseTo(3, 5)
  })
  it("is critical when the UPS says low battery", () => {
    expect(
      batteryModel(ups({ onBattery: true, lowBattery: true, chargePercent: 8 }), []).mode
    ).toBe("critical")
  })
  it("is unknown with no reading", () => {
    expect(batteryModel(null, [])).toMatchObject({ fill: 0, mode: "unknown" })
  })
})

describe("dialAngle", () => {
  it("sweeps from -120 at zero to +120 at the nominal rating and clamps beyond", () => {
    expect(dialAngle(0, 900)).toBe(-120)
    expect(dialAngle(450, 900)).toBe(0)
    expect(dialAngle(900, 900)).toBe(120)
    expect(dialAngle(2000, 900)).toBe(120)
    expect(dialAngle(null, 900)).toBe(-120)
  })
})
