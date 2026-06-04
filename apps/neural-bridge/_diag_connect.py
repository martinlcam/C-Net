"""Throwaway diagnostic: connect to the Muse, print services + full traceback."""

import asyncio
import traceback

from bleak import BleakClient, BleakScanner

ADDRESS = "00:55:DA:B3:7D:DB"


async def main() -> None:
    print(f"bleak resolving {ADDRESS} via scan ...", flush=True)
    dev = await BleakScanner.find_device_by_address(ADDRESS, timeout=15.0)
    print(f"  find_device_by_address -> {dev!r}", flush=True)

    target = dev if dev is not None else ADDRESS
    for attempt in range(1, 4):
        print(f"\n=== attempt {attempt}/3 — connecting (timeout=35s) ===", flush=True)
        try:
            async with BleakClient(target, timeout=35.0) as client:
                print(f"  connected={client.is_connected}", flush=True)
                print("  services discovered OK:", flush=True)
                for s in client.services:
                    print(f"    service {s.uuid}", flush=True)
                print("\nSUCCESS — GATT discovery worked.", flush=True)
                return
        except Exception as err:
            print(f"  FAILED type={type(err).__name__} repr={err!r}", flush=True)
            if attempt < 3:
                print("  waiting 4s before retry ...", flush=True)
                await asyncio.sleep(4)
    print("\nAll 3 attempts failed.", flush=True)
    traceback.print_exc()


asyncio.run(main())
