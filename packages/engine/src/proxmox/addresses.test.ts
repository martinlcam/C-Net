import { describe, expect, it } from "bun:test"
import { guestAddresses } from "./addresses"

describe("guestAddresses", () => {
  it("keeps real interface addresses and drops loopback, docker and veth plumbing", () => {
    const ifaces = [
      { name: "lo", inet: "127.0.0.1/8" },
      { name: "eth0", inet: "192.168.1.84/24" },
      { name: "br-c0c4c6357fe4", inet: "172.18.0.1/16" },
      { name: "docker0", inet: "172.17.0.1/16" },
      { name: "vethd4852fa" },
      { name: "eth1", inet: "10.0.0.5/24" },
    ]
    expect(guestAddresses(ifaces)).toEqual(["192.168.1.84", "10.0.0.5"])
  })
  it("is empty for a stopped guest with no interfaces", () => {
    expect(guestAddresses([])).toEqual([])
  })
})
