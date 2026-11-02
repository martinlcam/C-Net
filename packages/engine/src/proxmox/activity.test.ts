import { describe, expect, it } from "bun:test"
import { mapNodeService, mapNodeTask, mapRrdPoint } from "./activity"

describe("mapNodeTask", () => {
  const base = {
    upid: "UPID:proxbox:0001:0002:6AE8489D:vzstart:112:root@pam:",
    type: "vzstart",
    id: "112",
    user: "root@pam",
    node: "proxbox",
    starttime: 1_793_607_837,
  }
  it("marks a finished task OK or failed from its status", () => {
    const ok = mapNodeTask({ ...base, endtime: 1_793_607_840, status: "OK" })
    expect(ok).toMatchObject({ running: false, ok: true, endedAt: 1_793_607_840_000 })
    const failed = mapNodeTask({ ...base, endtime: 1_793_607_840, status: "command failed" })
    expect(failed).toMatchObject({ ok: false, status: "command failed" })
  })
  it("treats a task with no end time as running", () => {
    expect(mapNodeTask(base)).toMatchObject({
      running: true,
      ok: null,
      endedAt: null,
      startedAt: 1_793_607_837_000,
      id: "112",
    })
  })
})

describe("mapNodeService", () => {
  it("reads running from the active state and enabled from the unit state", () => {
    expect(
      mapNodeService({
        name: "pvedaemon",
        desc: "PVE API Daemon",
        state: "running",
        "active-state": "active",
        "unit-state": "enabled",
      })
    ).toEqual({
      name: "pvedaemon",
      description: "PVE API Daemon",
      state: "running",
      running: true,
      enabled: true,
    })
    expect(
      mapNodeService({ name: "corosync", state: "dead", "active-state": "inactive" })
    ).toMatchObject({ running: false, enabled: false, description: "" })
  })
})

describe("mapRrdPoint", () => {
  it("scales time to milliseconds and fills missing fields with zero", () => {
    expect(
      mapRrdPoint({ time: 1_793_604_900, cpu: 0.1, memused: 10, memtotal: 100, netin: "5" })
    ).toEqual({
      time: 1_793_604_900_000,
      cpu: 0.1,
      iowait: 0,
      loadavg: 0,
      memused: 10,
      memtotal: 100,
      swapused: 0,
      netin: 5,
      netout: 0,
      arcsize: 0,
    })
  })
  it("drops the empty future slots", () => {
    expect(mapRrdPoint({ time: 1_793_604_900 })).toBeNull()
  })
})
