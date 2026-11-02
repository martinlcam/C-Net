import { describe, expect, it } from "bun:test"
import {
  appendFrame,
  batteryModel,
  describeTask,
  dialAngle,
  diffGuestEvents,
  diskRate,
  type LiveFrame,
  type LiveGuest,
  type LiveUps,
  mergeActivity,
  netRate,
  nodeNetRate,
  rateSeries,
  type TaskLike,
  zfsRate,
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

describe("rates from cumulative counters", () => {
  const a = frame(0, [guest({ diskread: 1000, diskwrite: 0 })])
  const b = frame(2000, [guest({ diskread: 3048, diskwrite: 1024 })])
  it("gives guest disk read and write bytes per second", () => {
    expect(diskRate(a, b, 112)).toEqual({ readBps: 1024, writeBps: 512 })
    expect(diskRate(a, b, 999)).toEqual({ readBps: 0, writeBps: 0 })
  })
  it("gives the host uplink rate and reads older frames without counters as zero", () => {
    const p = { ...a, node: { ...a.node, netin: 100, netout: 0 } }
    const n = { ...b, node: { ...b.node, netin: 2148, netout: 50 } }
    expect(nodeNetRate(p, n)).toEqual({ inBps: 1024, outBps: 25 })
    expect(nodeNetRate(a, b)).toEqual({ inBps: 0, outBps: 0 })
  })
  it("gives a pool's read and write rate and zero for a pool that is missing", () => {
    const p = { ...a, zfs: [{ pool: "tank", reads: 1, writes: 1, nread: 0, nwritten: 0 }] }
    const n = { ...b, zfs: [{ pool: "tank", reads: 2, writes: 2, nread: 4096, nwritten: 2048 }] }
    expect(zfsRate(p, n, "tank")).toEqual({ readBps: 2048, writeBps: 1024 })
    expect(zfsRate(p, n, "cold")).toEqual({ readBps: 0, writeBps: 0 })
  })
  it("builds one point per interval", () => {
    const c = frame(4000, [guest({ diskread: 3048, diskwrite: 1024 })])
    expect(rateSeries([a, b, c], (p, n) => diskRate(p, n, 112).readBps)).toEqual([1024, 0])
    expect(rateSeries([a], () => 1)).toEqual([])
  })
})

describe("describeTask", () => {
  const names = new Map([[112, "jellyfin"]])
  const task = (over: Partial<TaskLike>): TaskLike => ({
    upid: "u",
    type: "vzdump",
    id: "112",
    startedAt: 1000,
    endedAt: 2000,
    running: false,
    ok: true,
    ...over,
  })
  it("names the guest and uses past, present or failed forms", () => {
    expect(describeTask(task({}), names)).toBe("jellyfin backed up")
    expect(describeTask(task({ running: true, endedAt: null, ok: null }), names)).toBe(
      "backing up jellyfin"
    )
    expect(describeTask(task({ type: "vzstart", ok: false }), names)).toBe(
      "jellyfin started failed"
    )
    expect(describeTask(task({ id: "999" }), names)).toBe("999 backed up")
  })
  it("handles node-level tasks and unknown types", () => {
    expect(describeTask(task({ type: "aptupdate", id: null }), names)).toBe(
      "package lists refreshed"
    )
    expect(describeTask(task({ type: "zfscreate", id: null }), names)).toBe("zfscreate")
    expect(describeTask(task({ type: "zfscreate", id: null, ok: false }), names)).toBe(
      "zfscreate failed"
    )
  })
})

describe("mergeActivity", () => {
  it("puts running tasks first, then everything newest first, capped", () => {
    const names = new Map([[112, "jellyfin"]])
    const events = [
      { ts: 5000, vmid: 112, name: "jellyfin", kind: "status", from: "stopped", to: "running" },
    ] as const
    const tasks: TaskLike[] = [
      {
        upid: "a",
        type: "vzdump",
        id: "112",
        startedAt: 1000,
        endedAt: null,
        running: true,
        ok: null,
      },
      {
        upid: "b",
        type: "vzstart",
        id: "112",
        startedAt: 4000,
        endedAt: 4500,
        running: false,
        ok: true,
      },
      {
        upid: "c",
        type: "aptupdate",
        id: null,
        startedAt: 9000,
        endedAt: 9500,
        running: false,
        ok: false,
      },
    ]
    const items = mergeActivity([...events], tasks, names, 3)
    expect(items.map((i) => [i.text, i.state])).toEqual([
      ["backing up jellyfin", "running"],
      ["package lists refreshed, failed", "failed"],
      ["jellyfin came up", "ok"],
    ])
  })
})
