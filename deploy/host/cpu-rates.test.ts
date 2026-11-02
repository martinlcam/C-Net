import { describe, expect, it } from "bun:test"
import { cgroupCpuFraction, parseProcStatCpu, procStatCpuRates } from "./cpu-rates"

describe("parseProcStatCpu", () => {
  it("reads the aggregate cpu line into busy, idle and iowait jiffies", () => {
    const line = "cpu  65936793 1576672 24800349 1245637963 17607578 0 1089918 0 0 0"
    expect(parseProcStatCpu(line)).toEqual({
      idle: 1245637963,
      iowait: 17607578,
      total: 65936793 + 1576672 + 24800349 + 1245637963 + 17607578 + 0 + 1089918 + 0,
    })
  })
})

describe("procStatCpuRates", () => {
  it("turns two samples into a busy fraction and an iowait fraction", () => {
    const prev = { idle: 1000, iowait: 100, total: 2000 }
    const next = { idle: 1500, iowait: 150, total: 3000 } // +1000 total, +500 idle, +50 iowait
    const r = procStatCpuRates(prev, next)
    expect(r.cpu).toBeCloseTo(0.45, 10)
    expect(r.iowait).toBeCloseTo(0.05, 10)
  })
  it("is zero, not NaN, when no time has passed", () => {
    const s = { idle: 1, iowait: 0, total: 1 }
    expect(procStatCpuRates(s, s)).toEqual({ cpu: 0, iowait: 0 })
  })
})

describe("cgroupCpuFraction", () => {
  it("is usage over wall time, as a fraction of the cores the guest may use", () => {
    // 1_000_000 µs of CPU in 2 s on 2 cores = 25% of its allotment.
    expect(cgroupCpuFraction(5_000_000, 6_000_000, 2000, 2)).toBeCloseTo(0.25, 6)
  })
  it("clamps counter resets and zero intervals to zero", () => {
    expect(cgroupCpuFraction(6_000_000, 5_000_000, 2000, 2)).toBe(0)
    expect(cgroupCpuFraction(5_000_000, 6_000_000, 0, 2)).toBe(0)
  })
})
