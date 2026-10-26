import { describe, expect, it } from "bun:test"
import { parseRetiredSpec, withRetiredPools } from "./retired"
import { assembleBays } from "./storage"
import type { PoolStatus } from "./storage-types"

const SPEC = "11:ZA13EK55:cold_tank:mirror, 12:ZA13KGFQ:cold_tank:mirror"

describe("parseRetiredSpec", () => {
  it("reads bay, serial, pool and raid from the env value, ignoring blanks", () => {
    expect(parseRetiredSpec(SPEC)).toEqual([
      { bayIndex: 11, serial: "ZA13EK55", pool: "cold_tank", raid: "mirror" },
      { bayIndex: 12, serial: "ZA13KGFQ", pool: "cold_tank", raid: "mirror" },
    ])
    expect(parseRetiredSpec(undefined)).toEqual([])
    expect(parseRetiredSpec("")).toEqual([])
  })
  it("skips malformed entries rather than failing the whole list", () => {
    expect(parseRetiredSpec("nonsense,12:ZA13KGFQ:cold_tank:mirror")).toEqual([
      { bayIndex: 12, serial: "ZA13KGFQ", pool: "cold_tank", raid: "mirror" },
    ])
  })
})

const online: PoolStatus = {
  name: "tank_main",
  state: "ONLINE",
  raid: "raidz3",
  sizeBytes: 10,
  allocBytes: 1,
  freeBytes: 9,
  fragPercent: 0,
  scan: { kind: "none", inProgress: false, raw: "none requested" },
  errors: "No known data errors",
  vdevs: [],
}

describe("withRetiredPools", () => {
  it("adds an OFFLINE entry for a retired pool that Proxmox no longer lists", () => {
    const pools = withRetiredPools([online], parseRetiredSpec(SPEC))
    expect(pools.map((p) => p.name)).toEqual(["tank_main", "cold_tank"])
    const cold = pools[1]
    expect(cold.state).toBe("OFFLINE")
    expect(cold.raid).toBe("mirror")
    expect(cold.vdevs.map((v) => [v.serial, v.state])).toEqual([
      ["ZA13EK55", "OFFLINE"],
      ["ZA13KGFQ", "OFFLINE"],
    ])
    expect(cold.scan.raw).toMatch(/exported/i)
  })
  it("leaves a pool alone when Proxmox still lists it", () => {
    const stillThere = { ...online, name: "cold_tank", state: "DEGRADED" }
    const pools = withRetiredPools([stillThere], parseRetiredSpec(SPEC))
    expect(pools).toHaveLength(1)
    expect(pools[0].state).toBe("DEGRADED")
  })
})

describe("assembleBays with retired bays", () => {
  it("shows a retired bay as occupied, powered down, and a member of its pool", () => {
    const retired = parseRetiredSpec(SPEC)
    const pools = withRetiredPools([online], retired)
    const inventory = [
      { bayIndex: 11, byPath: "x", present: false },
      { bayIndex: 12, byPath: "y", present: false },
    ]
    const bays = assembleBays([], pools, inventory, retired)
    const b11 = bays.find((b) => b.bayIndex === 11)
    expect(b11).toMatchObject({
      occupied: true,
      offline: false,
      retired: true,
      serial: "ZA13EK55",
      pool: "cold_tank",
      zfsState: "OFFLINE",
    })
    const b1 = bays.find((b) => b.bayIndex === 1)
    expect(b1?.retired).toBe(false)
  })
})
