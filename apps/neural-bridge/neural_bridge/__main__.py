"""Neural-bridge CLI. Two subcommands:

    python -m neural_bridge scan [--seconds N] [--all]
    python -m neural_bridge run  [--address ADDR] [--preset 21]

`scan` is dependency-light — it only needs `bleak` — so you can verify the
headband is reachable before installing/running Redis.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover — dotenv is a hard dep, but be polite
    load_dotenv = None  # type: ignore[assignment]


def _load_env() -> None:
    """Load the monorepo-root .env. All bridge config (MUSE_ADDRESS, REDIS_URL,
    BD_NOTCH_HZ, MUSE_PRESET, channels) lives there alongside the rest of the
    project's env — there is intentionally no per-app .env for the bridge."""
    if load_dotenv is None:
        return
    # __main__.py -> neural_bridge -> apps/neural-bridge -> apps -> repo root
    repo_root = Path(__file__).resolve().parents[3]
    load_dotenv(repo_root / ".env", override=False)


async def cmd_scan(args: argparse.Namespace) -> int:
    from bleak import BleakScanner

    seconds = float(args.seconds)
    print(f"Scanning {seconds:.0f}s for BLE devices nearby...", flush=True)
    devices = await BleakScanner.discover(timeout=seconds, return_adv=True)

    rows: list[tuple[str, str, Optional[int]]] = []
    for _addr, (device, adv) in devices.items():
        name = device.name or adv.local_name or ""
        if not args.all and not name.lower().startswith("muse"):
            continue
        rows.append((device.address, name or "(no name)", adv.rssi))

    rows.sort(key=lambda r: (-(r[2] or -999), r[0]))

    if not rows:
        if args.all:
            print("No BLE devices found at all. Bluetooth radio off?", flush=True)
        else:
            print(
                "No Muse-* devices found.\n"
                "  - close the Muse app on your phone (BLE allows 1 client at a time)\n"
                "  - power-cycle the headband\n"
                "  - re-run with --all to confirm Bluetooth is alive",
                flush=True,
            )
        return 1

    print()
    print(f"  {'ADDRESS':<22}{'NAME':<22}RSSI")
    print(f"  {'-' * 20:<22}{'-' * 20:<22}----")
    for addr, name, rssi in rows:
        rssi_str = "" if rssi is None else f"{rssi:>4} dBm"
        print(f"  {addr:<22}{name:<22}{rssi_str}")
    print()

    if not args.all:
        first = rows[0][0]
        print(f"Tip: put this in apps/neural-bridge/.env -> MUSE_ADDRESS={first}", flush=True)
    return 0


async def cmd_run(args: argparse.Namespace) -> int:
    address = args.address or os.environ.get("MUSE_ADDRESS", "").strip()
    if not address:
        # Best-effort: pick first Muse-* nearby.
        from bleak import BleakScanner

        print("MUSE_ADDRESS not set — scanning briefly for one...", flush=True)
        found = await BleakScanner.discover(timeout=8.0, return_adv=True)
        candidate = None
        for _, (device, adv) in found.items():
            name = (device.name or adv.local_name or "").lower()
            if name.startswith("muse"):
                candidate = device.address
                print(f"  picked {device.address} ({device.name})", flush=True)
                break
        if not candidate:
            print(
                "No MUSE_ADDRESS in env and no Muse found in 8s. "
                "Run `python -m neural_bridge scan` to set one.",
                flush=True,
            )
            return 2
        address = candidate

    preset = args.preset or os.environ.get("MUSE_PRESET", "21")
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6380")
    ch_samples = os.environ.get("BD_REDIS_CHANNEL_SAMPLES", "bd:samples")
    ch_status = os.environ.get("BD_REDIS_CHANNEL_STATUS", "bd:status")

    # Imported late so `scan` works even with no redis-server installed.
    from .publisher import run_forever

    await run_forever(
        address=address,
        preset=preset,
        redis_url=redis_url,
        channel_samples=ch_samples,
        channel_status=ch_status,
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m neural_bridge",
        description="Muse 2 -> Redis pub/sub bridge for the C-Net BD page.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    scan = sub.add_parser("scan", help="Scan for nearby BLE devices (Muse-only by default).")
    scan.add_argument("--seconds", default=10, type=float, help="Scan duration (default 10).")
    scan.add_argument("--all", action="store_true", help="Show every BLE device, not just Muse.")

    run = sub.add_parser("run", help="Connect to Muse and stream to Redis.")
    run.add_argument("--address", help="MAC address (overrides MUSE_ADDRESS env).")
    run.add_argument("--preset", help="Muse preset, default 21.")

    return p


def main() -> None:
    _load_env()
    args = build_parser().parse_args()
    handler = {"scan": cmd_scan, "run": cmd_run}[args.cmd]
    try:
        rc = asyncio.run(handler(args))
    except KeyboardInterrupt:
        rc = 130
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
