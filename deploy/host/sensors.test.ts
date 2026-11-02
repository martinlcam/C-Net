import { describe, expect, it } from "bun:test"
import {
  DEFAULT_SENSOR_LABELS,
  meanKhzToMhz,
  milliToC,
  parsePsiSome,
  parseSensorLabels,
  pwmToPercent,
  sumObjsetCounters,
} from "./sensors"

describe("hwmon values", () => {
  it("turns millidegrees into one-decimal celsius and 0..255 duty into percent", () => {
    expect(milliToC("65125\n")).toBe(65.1)
    expect(milliToC(null)).toBeNull()
    expect(pwmToPercent("17")).toBe(7)
    expect(pwmToPercent("255")).toBe(100)
    expect(pwmToPercent("garbage")).toBeNull()
  })
})

describe("parseSensorLabels", () => {
  it("maps driver:input keys to labels and skips malformed parts", () => {
    const m = parseSensorLabels(DEFAULT_SENSOR_LABELS)
    expect(m.get("k10temp:temp1")).toBe("CPU")
    expect(m.get("nouveau:pwm1")).toBe("GPU fan")
    expect(parseSensorLabels("nolabel,=x,a:b=").size).toBe(0)
  })
})

describe("parsePsiSome", () => {
  it("reads the 10 s 'some' average", () => {
    const text = "some avg10=0.12 avg60=0.08 avg300=0.05 total=123\nfull avg10=0.00 avg60=0.00\n"
    expect(parsePsiSome(text)).toBe(0.12)
    expect(parsePsiSome(null)).toBeNull()
  })
})

describe("sumObjsetCounters", () => {
  it("adds the four counters across every dataset of a pool", () => {
    const a =
      "name type data\ndataset_name 7 tank/media\nwrites 4 10\nnwritten 4 1000\nreads 4 5\nnread 4 500\n"
    const b = "dataset_name 7 tank/other\nwrites 4 1\nnwritten 4 1\nreads 4 1\nnread 4 1\n"
    expect(sumObjsetCounters("tank", [a, b])).toEqual({
      pool: "tank",
      reads: 6,
      writes: 11,
      nread: 501,
      nwritten: 1001,
    })
  })
})

describe("meanKhzToMhz", () => {
  it("averages readable cores and ignores the rest", () => {
    expect(meanKhzToMhz(["4000000", "3000000", null, "x"])).toBe(3500)
    expect(meanKhzToMhz([null])).toBeNull()
  })
})
