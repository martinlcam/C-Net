"""Throwaway diagnostic: bond (pair) the Muse, then connect + discover GATT."""

import asyncio
import traceback

from bleak import BleakClient, BleakScanner

ADDRESS = "00:55:DA:B3:7D:DB"


async def main() -> None:
    print(f"scanning for {ADDRESS} (15s) ...", flush=True)
    dev = await BleakScanner.find_device_by_address(ADDRESS, timeout=15.0)
    if dev is None:
        print("  NOT FOUND — Muse isn't advertising. Power-cycle it (LED blinking) "
              "and make sure the phone's Bluetooth is OFF.", flush=True)
        return
    print(f"  found {dev!r}", flush=True)

    client = BleakClient(dev, timeout=35.0)
    try:
        print("connecting ...", flush=True)
        await client.connect()
        print(f"  connected={client.is_connected}", flush=True)
    except Exception as err:
        print(f"  connect failed: type={type(err).__name__} repr={err!r}", flush=True)
        # Try to pair even if the GATT-bearing connect failed.
    try:
        print("attempting pair/bond ...", flush=True)
        paired = await client.pair()
        print(f"  pair() -> {paired}", flush=True)
    except Exception as err:
        print(f"  pair failed: type={type(err).__name__} repr={err!r}", flush=True)
        traceback.print_exc()

    try:
        if not client.is_connected:
            print("reconnecting after pair ...", flush=True)
            await client.connect()
        print(f"  connected={client.is_connected}", flush=True)
        print("  services:", flush=True)
        for s in client.services:
            print(f"    {s.uuid}", flush=True)
        print("\nSUCCESS — GATT readable after pairing.", flush=True)
    except Exception as err:
        print(f"  post-pair connect failed: type={type(err).__name__} repr={err!r}", flush=True)
        traceback.print_exc()
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass


asyncio.run(main())
