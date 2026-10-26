import type { GuestInterface } from "./types"

// Loopback plus the plumbing Docker creates inside a container: none of it is an
// address a person would use to reach the guest.
const PLUMBING = /^(lo|docker\d*|br-[0-9a-f]+|veth[0-9a-f]+)$/

/** The guest's reachable IPv4 addresses, without prefix lengths, in interface order. */
export function guestAddresses(ifaces: GuestInterface[]): string[] {
  return ifaces
    .filter((i) => !PLUMBING.test(i.name))
    .flatMap((i) => (i.inet ? [i.inet.replace(/\/\d+$/, "")] : []))
}
