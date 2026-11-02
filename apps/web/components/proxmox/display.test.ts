import { describe, expect, it } from "bun:test"
import {
  fanSpeed,
  fanText,
  fmtRuntime,
  poolTone,
  powerLine,
  rate,
  scanSummary,
  storageState,
  tempTone,
  usageTone,
} from "./display"
import type { OverviewUps } from "./overview-api"

describe("usageTone", () => {
  it("is calm below 70, warm to 90, hot above", () => {
    expect(usageTone(12)).toBe("ok")
    expect(usageTone(70)).toBe("warn")
    expect(usageTone(89.9)).toBe("warn")
    expect(usageTone(90)).toBe("bad")
  })
})

describe("poolTone", () => {
  it("maps zpool states to tones and treats anything unknown as bad", () => {
    expect(poolTone("ONLINE")).toBe("ok")
    expect(poolTone("DEGRADED")).toBe("warn")
    expect(poolTone("FAULTED")).toBe("bad")
    expect(poolTone("UNAVAIL")).toBe("bad")
    expect(poolTone("SUSPENDED")).toBe("bad")
  })
})

describe("fmtRuntime", () => {
  it("rounds to whole minutes and says hours when long", () => {
    expect(fmtRuntime(3575)).toBe("60 min")
    expect(fmtRuntime(300)).toBe("5 min")
    expect(fmtRuntime(45)).toBe("under a minute")
    expect(fmtRuntime(7260)).toBe("2 h 1 min")
    expect(fmtRuntime(null)).toBe("unknown runtime")
  })
})

describe("powerLine", () => {
  const base: OverviewUps = {
    ts: 0,
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
  }
  const reading = (over: Partial<OverviewUps>): OverviewUps => ({ ...base, ...over })
  it("reads as one plain sentence on mains", () => {
    expect(powerLine(base)).toEqual({
      tone: "ok",
      text: "On wall power, battery full, 60 min of runtime at 153 W",
    })
  })
  it("switches to the battery wording and a warning tone when on battery", () => {
    expect(
      powerLine(reading({ status: ["OB", "DISCHRG"], onBattery: true, chargePercent: 82 }))
    ).toEqual({
      tone: "warn",
      text: "On battery, 82% charge, 60 min left at 153 W",
    })
  })
  it("is hot when the UPS reports low battery", () => {
    expect(
      powerLine(
        reading({
          status: ["OB", "LB"],
          onBattery: true,
          lowBattery: true,
          chargePercent: 9,
          runtimeSeconds: 70,
        })
      ).tone
    ).toBe("bad")
  })
  it("says so when there is no reading", () => {
    expect(powerLine(null)).toEqual({ tone: "none", text: "No reading from the UPS" })
  })
})

describe("scanSummary", () => {
  it("turns zpool scan lines into a short phrase", () => {
    expect(
      scanSummary("scrub repaired 0B in 01:36:45 with 0 errors on Sun Oct 25 03:36:46 2026")
    ).toBe("last scrub clean")
    expect(
      scanSummary("scrub repaired 12K in 02:10:00 with 3 errors on Sun Oct 25 03:36:46 2026")
    ).toBe("last scrub found 3 errors")
    expect(scanSummary("scrub in progress since Sun Oct 25 03:00:00 2026")).toBe(
      "scrub in progress"
    )
    expect(scanSummary("resilver in progress since Sun Oct 25 03:00:00 2026")).toBe(
      "resilver in progress"
    )
    expect(scanSummary("none requested")).toBe("")
    expect(scanSummary("")).toBe("")
  })
})

describe("storageState", () => {
  it("describes pools by raid and health, mounts plainly, and says when not mounted", () => {
    expect(storageState({ active: true, type: "dir", pool: null })).toBe("mounted")
    expect(storageState({ active: false, type: "zfspool", pool: null })).toBe("not mounted")
    expect(
      storageState({
        active: true,
        type: "zfspool",
        pool: { state: "ONLINE", raid: "raidz3", scan: "", errors: "No known data errors" },
      })
    ).toBe("raidz3, online")
    expect(
      storageState({
        active: true,
        type: "zfspool",
        pool: { state: "DEGRADED", raid: "mirror", scan: "", errors: "No known data errors" },
      })
    ).toBe("mirror, degraded")
    expect(
      storageState({
        active: true,
        type: "zfspool",
        pool: { state: "ONLINE", raid: "raidz3", scan: "", errors: "2 data errors" },
      })
    ).toBe("raidz3, online, data errors")
  })
})

describe("tempTone", () => {
  it("is calm to 75, warm to 85, hot beyond", () => {
    expect(tempTone(65.1)).toBe("ok")
    expect(tempTone(75)).toBe("warn")
    expect(tempTone(85)).toBe("bad")
  })
})

describe("fans", () => {
  it("spins by duty when known, else by rpm, and prints whichever exists", () => {
    expect(fanSpeed({ rpm: null, percent: 7 })).toBeCloseTo(0.07)
    expect(fanSpeed({ rpm: 1000, percent: null })).toBe(0.5)
    expect(fanSpeed({ rpm: null, percent: null })).toBe(0)
    expect(fanText({ rpm: 1200, percent: 40 })).toBe("1200 rpm")
    expect(fanText({ rpm: null, percent: 7 })).toBe("7%")
  })
})

describe("rate", () => {
  it("picks a unit that keeps the number short", () => {
    expect(rate(0)).toBe("0 B/s")
    expect(rate(1536)).toBe("1.5 KiB/s")
    expect(rate(2.5 * 1024 * 1024)).toBe("2.5 MiB/s")
  })
})
