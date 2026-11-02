import { describe, expect, it } from "bun:test"
import { mapNodeStatus } from "./node-status"

describe("mapNodeStatus", () => {
  it("reads cores from cpuinfo and the cpu fraction as a percentage", () => {
    const raw = {
      cpu: 0.116080884299709,
      cpuinfo: { cpus: 12, model: "AMD Ryzen" },
      memory: { used: 10597015552, total: 33573847040 },
      rootfs: { used: 28_000_000_000, total: 73_000_000_000 },
      uptime: 1133742,
      loadavg: ["1.06", "1.55", "1.55"],
      wait: 0.0043,
    }
    const m = mapNodeStatus("proxbox", raw)
    expect(m.cpu.cores).toBe(12)
    expect(m.cpu.usage).toBeCloseTo(11.6, 1)
    expect(m.memory.percent).toBeCloseTo(31.56, 1)
    expect(m.disk.percent).toBeCloseTo(38.36, 1)
    expect(m.uptime).toBe(1133742)
  })
  it("tolerates a status with nothing but a name", () => {
    expect(mapNodeStatus("n", {})).toEqual({
      node: "n",
      uptime: undefined,
      cpu: { usage: 0, cores: 0 },
      memory: { used: 0, total: 0, percent: 0 },
      disk: { used: 0, total: 0, percent: 0 },
    })
  })
})
