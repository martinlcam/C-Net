import { describe, expect, it } from "bun:test"
import { parseUpsc, summarizeUps } from "./ups"

const SAMPLE = `battery.charge: 100
battery.charge.low: 35
battery.runtime: 3575
battery.runtime.low: 300
device.model: CST150UC
input.voltage: 115.0
output.voltage: 115.0
ups.load: 17
ups.mfr: CPS
ups.model: CST150UC
ups.realpower.nominal: 900
ups.status: OL
ups.test.result: No test initiated
`

describe("parseUpsc", () => {
  it("turns upsc's key: value lines into a map, keeping values with colons intact", () => {
    const vars = parseUpsc("a.b: 1\nups.test.result: No test: initiated\n\nbad line\n")
    expect(vars).toEqual({ "a.b": "1", "ups.test.result": "No test: initiated" })
  })
})

describe("summarizeUps", () => {
  it("reads charge, runtime, load and derives watts from the nominal rating", () => {
    const s = summarizeUps(parseUpsc(SAMPLE), 1_700_000_000_000)
    expect(s).toEqual({
      ts: 1_700_000_000_000,
      model: "CST150UC",
      status: ["OL"],
      onBattery: false,
      lowBattery: false,
      chargePercent: 100,
      runtimeSeconds: 3575,
      loadPercent: 17,
      loadWatts: 153,
      inputVoltage: 115,
      outputVoltage: 115,
    })
  })

  it("flags on-battery and low-battery from the status tokens", () => {
    const s = summarizeUps(parseUpsc("ups.status: OB LB DISCHRG\nbattery.charge: 12\n"), 1)
    expect(s.onBattery).toBe(true)
    expect(s.lowBattery).toBe(true)
    expect(s.status).toEqual(["OB", "LB", "DISCHRG"])
    expect(s.chargePercent).toBe(12)
    expect(s.loadWatts).toBeNull()
  })

  it("leaves unknown figures null instead of inventing zeros", () => {
    const s = summarizeUps(parseUpsc("ups.status: OL\n"), 1)
    expect(s.chargePercent).toBeNull()
    expect(s.runtimeSeconds).toBeNull()
    expect(s.loadPercent).toBeNull()
    expect(s.model).toBeNull()
  })
})
