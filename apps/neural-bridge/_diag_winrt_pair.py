"""Probe + pair the Muse straight through the WinRT Bluetooth API.

Bypasses the (broken-for-BLE) Windows Settings 'Add device' GUI. Tells us:
  - whether Windows can resolve the device from its address
  - can_pair / is_paired
  - the result of a 'just works' (ConfirmOnly) pairing ceremony
"""

import asyncio

from winrt.windows.devices.bluetooth import BluetoothLEDevice
from winrt.windows.devices.enumeration import (
    DevicePairingKinds,
    DevicePairingProtectionLevel,
)

ADDRESS = "00:55:DA:B3:7D:DB"


async def main() -> None:
    addr_int = int(ADDRESS.replace(":", ""), 16)
    print(f"resolving 0x{addr_int:012X} via WinRT ...", flush=True)
    dev = await BluetoothLEDevice.from_bluetooth_address_async(addr_int)
    if dev is None:
        print("  device is None — Windows couldn't resolve it. Is it blinking?", flush=True)
        return

    info = dev.device_information
    pairing = info.pairing
    print(f"  name={info.name!r}", flush=True)
    print(f"  can_pair={pairing.can_pair}  is_paired={pairing.is_paired}", flush=True)

    if pairing.is_paired:
        print("  already paired — nothing to do.", flush=True)
        return
    if not pairing.can_pair:
        print("  *** device reports can_pair=False — it does NOT support bonding. ***", flush=True)
        print("  => 'Unreachable' is NOT a pairing problem. Different root cause.", flush=True)
        return

    custom = pairing.custom

    def on_pairing_requested(_sender, args):
        print(f"  pairing requested: kind={args.pairing_kind}", flush=True)
        args.accept()

    custom.add_pairing_requested(on_pairing_requested)

    print("  starting ConfirmOnly pairing ceremony ...", flush=True)
    result = await custom.pair_async(DevicePairingKinds.CONFIRM_ONLY)
    print(f"  pairing status = {result.status}", flush=True)
    print(f"  is_paired now = {info.pairing.is_paired}", flush=True)


asyncio.run(main())
