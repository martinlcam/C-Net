"""Connect to a Muse 2, decode samples, and publish batched frames to Redis.

The frame format (`{t,ts,eeg?,ppg?,acc?,gyro?}` for samples, `{t,ts,connected,...}`
for status) is consumed by `apps/realtime` and ultimately by `apps/web/.../bd`.
Both ends intentionally share nothing but JSON.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from bleak import BleakClient, BleakScanner

from . import muse_protocol as mp
from .bandpower import BANDPOWER_AVAILABLE, compute_band_powers
from .decoders import (
    decode_acc,
    decode_eeg,
    decode_gyro,
    decode_ppg,
    decode_telemetry,
)

SAMPLE_FLUSH_MS = 100
STATUS_HEARTBEAT_MS = 1000

EEG_RATE = 256  # Muse EEG sample rate (Hz)
BANDPOWER_WINDOW = 512  # rolling EEG window for the PSD (~2 s @ 256 Hz)
BANDPOWER_INTERVAL_MS = 200  # publish band powers at ~5 Hz


@dataclass
class _Buffers:
    """In-memory holding pen for samples between flushes."""

    # EEG is special: each notification is per-channel. We need to group them
    # by `sequence` so a flushed frame contains aligned 4-tuples.
    eeg_by_seq: dict[int, list[Optional[list[float]]]] = field(default_factory=dict)
    ppg_by_seq: dict[int, list[Optional[list[int]]]] = field(default_factory=dict)
    acc: list[tuple[float, float, float]] = field(default_factory=list)
    gyro: list[tuple[float, float, float]] = field(default_factory=list)

    def reset(self) -> None:
        self.eeg_by_seq.clear()
        self.ppg_by_seq.clear()
        self.acc.clear()
        self.gyro.clear()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _publish(redis_client, channel: str, payload: dict) -> None:
    """Fire-and-forget publish. Errors logged but never raised — the bridge
    must outlive any single Redis hiccup."""
    try:
        redis_client.publish(channel, json.dumps(payload, separators=(",", ":")))
    except Exception as err:  # noqa: BLE001 — we genuinely want to swallow everything
        print(f"[bridge] redis publish failed on {channel}: {err}", flush=True)


def _drain_eeg(buf: _Buffers) -> list[list[float]]:
    """Return aligned EEG 4-tuples for every sequence that has all 4 channels.

    Each notification carries 12 samples, so each "complete" sequence yields
    12 aligned 4-tuples. Incomplete sequences are kept for the next flush,
    capped so an unresponsive channel can't grow the buffer without bound.
    """
    out: list[list[float]] = []
    complete_seqs = sorted(seq for seq, slots in buf.eeg_by_seq.items() if all(slots))
    for seq in complete_seqs:
        slots = buf.eeg_by_seq.pop(seq)
        ch0, ch1, ch2, ch3 = slots[0], slots[1], slots[2], slots[3]
        assert ch0 is not None and ch1 is not None and ch2 is not None and ch3 is not None
        for i in range(mp.EEG_SAMPLES_PER_PACKET):
            out.append([ch0[i], ch1[i], ch2[i], ch3[i]])
    # Cap the unfinished-sequence backlog at 8 to prevent unbounded growth.
    if len(buf.eeg_by_seq) > 8:
        oldest = sorted(buf.eeg_by_seq.keys())[:-8]
        for seq in oldest:
            buf.eeg_by_seq.pop(seq, None)
    return out


def _drain_ppg(buf: _Buffers) -> list[list[int]]:
    out: list[list[int]] = []
    complete_seqs = sorted(seq for seq, slots in buf.ppg_by_seq.items() if all(slots))
    for seq in complete_seqs:
        slots = buf.ppg_by_seq.pop(seq)
        ch0, ch1, ch2 = slots[0], slots[1], slots[2]
        assert ch0 is not None and ch1 is not None and ch2 is not None
        for i in range(mp.PPG_SAMPLES_PER_PACKET):
            out.append([ch0[i], ch1[i], ch2[i]])
    if len(buf.ppg_by_seq) > 8:
        oldest = sorted(buf.ppg_by_seq.keys())[:-8]
        for seq in oldest:
            buf.ppg_by_seq.pop(seq, None)
    return out


async def stream_once(
    address: str,
    preset: str | int,
    redis_client,
    channel_samples: str,
    channel_status: str,
) -> None:
    """Single connect-and-stream attempt. Returns when the BLE link drops
    or an unrecoverable error occurs; the outer `run_forever` loop reconnects.
    """
    buf = _Buffers()
    battery_pct: Optional[float] = None
    last_packet_ts = _now_ms()

    # ---- per-characteristic notification handlers ---------------------------

    def on_eeg(uuid: str, data: bytearray) -> None:
        nonlocal last_packet_ts
        ch_idx = mp.EEG_CHANNEL_INDEX.get(uuid)
        if ch_idx is None:
            return
        pkt = decode_eeg(data)
        slot = buf.eeg_by_seq.setdefault(pkt.sequence, [None, None, None, None])
        slot[ch_idx] = pkt.samples_uv
        last_packet_ts = _now_ms()

    def on_ppg(uuid: str, data: bytearray) -> None:
        nonlocal last_packet_ts
        ch_idx = mp.PPG_CHANNEL_INDEX.get(uuid)
        if ch_idx is None:
            return
        pkt = decode_ppg(data)
        slot = buf.ppg_by_seq.setdefault(pkt.sequence, [None, None, None])
        slot[ch_idx] = pkt.samples_raw
        last_packet_ts = _now_ms()

    def on_acc(_uuid: str, data: bytearray) -> None:
        nonlocal last_packet_ts
        buf.acc.extend(decode_acc(data).samples)
        last_packet_ts = _now_ms()

    def on_gyro(_uuid: str, data: bytearray) -> None:
        nonlocal last_packet_ts
        buf.gyro.extend(decode_gyro(data).samples)
        last_packet_ts = _now_ms()

    def on_telemetry(_uuid: str, data: bytearray) -> None:
        nonlocal battery_pct
        battery_pct = decode_telemetry(data).battery_pct

    # bleak passes (sender_obj, bytearray) to callbacks. Wrap so we always
    # get a UUID string (sender_obj is a `BleakGATTCharacteristic` whose
    # `.uuid` is the value we matched on).
    def _wrap(handler):
        def cb(sender, data):
            handler(getattr(sender, "uuid", str(sender)).lower(), data)

        return cb

    print(f"[bridge] connecting to {address} ...", flush=True)
    _publish(
        redis_client,
        channel_status,
        {
            "t": "status",
            "ts": _now_ms(),
            "connected": False,
            "address": address,
            "note": "CONNECTING",
        },
    )

    # On Linux/BlueZ, BleakClient(address_string) launches its own internal scan
    # to resolve the address, which races with any other scan and hangs. Resolve
    # the device first (the scanner stops cleanly), then connect to that object.
    device = await BleakScanner.find_device_by_address(address, timeout=20.0)
    if device is None:
        raise RuntimeError(f"device {address} not advertising (scan timed out)")

    async with BleakClient(device) as client:
        if not client.is_connected:
            raise RuntimeError("BleakClient reported not-connected after async-with")
        device_name = getattr(client, "address", address)

        # Subscribe to every characteristic we care about.
        subscriptions = [
            (mp.UUID_EEG_TP9, _wrap(on_eeg)),
            (mp.UUID_EEG_AF7, _wrap(on_eeg)),
            (mp.UUID_EEG_AF8, _wrap(on_eeg)),
            (mp.UUID_EEG_TP10, _wrap(on_eeg)),
            (mp.UUID_PPG_AMBIENT, _wrap(on_ppg)),
            (mp.UUID_PPG_INFRARED, _wrap(on_ppg)),
            (mp.UUID_PPG_RED, _wrap(on_ppg)),
            (mp.UUID_ACCELEROMETER, _wrap(on_acc)),
            (mp.UUID_GYRO, _wrap(on_gyro)),
            (mp.UUID_TELEMETRY, _wrap(on_telemetry)),
        ]
        for uuid, cb in subscriptions:
            try:
                await client.start_notify(uuid, cb)
            except Exception as err:  # noqa: BLE001
                print(f"[bridge] warn: start_notify({uuid}) failed: {err}", flush=True)

        # The original Muse 2016 (RevE) DROPS the BLE connection if it receives the
        # halt command, and ignores the p21 preset — it streams on its native preset
        # (32) the moment it gets the resume ('d') command. So send only resume.
        # (Newer Muse 2/S models want halt -> preset -> resume; branch per-model if
        # we ever add them — which is why `preset` is currently left unused.)
        await client.write_gatt_char(mp.UUID_STREAM_TOGGLE, mp.CMD_RESUME, response=False)

        # Reset the drop-detection clock now that streaming has actually been
        # requested. Subscription setup above can eat several seconds, and we don't
        # want that counted against the first-packet timeout.
        last_packet_ts = _now_ms()

        print("[bridge] streaming. Ctrl+C to stop.", flush=True)
        _publish(
            redis_client,
            channel_status,
            {
                "t": "status",
                "ts": _now_ms(),
                "connected": True,
                "deviceName": device_name,
                "address": address,
                "battery": None,
                "note": "STREAMING",
            },
        )

        last_status_ms = _now_ms()
        last_flush_ms = _now_ms()
        last_keepalive_ms = _now_ms()

        # Rolling EEG buffer + cadence for server-side band-power computation.
        eeg_window: deque = deque(maxlen=BANDPOWER_WINDOW)
        last_bands_ms = _now_ms()
        notch_hz = float(os.environ.get("BD_NOTCH_HZ", "60"))

        # Main service loop. Heavy lifting happens inside the bleak callbacks;
        # this loop drains the buffers, emits status heartbeats, and publishes
        # band powers computed with BrainFlow.
        while client.is_connected:
            await asyncio.sleep(0.025)
            now = _now_ms()

            if now - last_flush_ms >= SAMPLE_FLUSH_MS:
                eeg = _drain_eeg(buf)
                ppg = _drain_ppg(buf)
                acc = [list(t) for t in buf.acc]
                gyro = [list(t) for t in buf.gyro]
                buf.acc.clear()
                buf.gyro.clear()
                if eeg or ppg or acc or gyro:
                    frame = {"t": "sample", "ts": now}
                    if eeg:
                        frame["eeg"] = eeg
                        eeg_window.extend(eeg)  # feed the rolling band-power buffer
                    if ppg:
                        frame["ppg"] = ppg
                    if acc:
                        frame["acc"] = acc
                    if gyro:
                        frame["gyro"] = gyro
                    _publish(redis_client, channel_samples, frame)
                last_flush_ms = now

            if now - last_status_ms >= STATUS_HEARTBEAT_MS:
                _publish(
                    redis_client,
                    channel_status,
                    {
                        "t": "status",
                        "ts": now,
                        "connected": True,
                        "deviceName": device_name,
                        "address": address,
                        "battery": None if battery_pct is None else round(battery_pct, 1),
                    },
                )
                last_status_ms = now

            # Band powers: compute server-side with BrainFlow over the rolling
            # window and publish on the samples channel as a `bands` frame. The
            # browser just renders these — no FFT in JS.
            if (
                BANDPOWER_AVAILABLE
                and now - last_bands_ms >= BANDPOWER_INTERVAL_MS
                and len(eeg_window) >= EEG_RATE
            ):
                try:
                    bands = compute_band_powers(list(eeg_window), EEG_RATE, notch_hz)
                except Exception as err:  # noqa: BLE001
                    bands = None
                    print(f"[bridge] band-power error: {err}", flush=True)
                if bands is not None:
                    _publish(
                        redis_client,
                        channel_samples,
                        {"t": "bands", "ts": now, "rate": EEG_RATE, "abs": bands},
                    )
                last_bands_ms = now

            # Drop-detection: if nothing has arrived for 15 s, the headband
            # has gone away (battery, taken off, etc.). Break and let the outer
            # loop reconnect. 15 s (not 5 s) leaves room for the first packet to
            # arrive after a slow BlueZ connect + subscribe.
            if now - last_packet_ts > 15000:
                print("[bridge] no packets in 15s — disconnecting", flush=True)
                break

            # Belt-and-suspenders keepalive every 10 s.
            if now - last_keepalive_ms >= 10_000:
                try:
                    await client.write_gatt_char(
                        mp.UUID_STREAM_TOGGLE, mp.CMD_KEEPALIVE, response=False
                    )
                except Exception:  # noqa: BLE001
                    pass
                last_keepalive_ms = now

    # `async with` unsubscribes + disconnects on exit.
    _publish(
        redis_client,
        channel_status,
        {
            "t": "status",
            "ts": _now_ms(),
            "connected": False,
            "address": address,
            "note": "DISCONNECTED",
        },
    )


def _bluetoothctl_remove(address: str) -> None:
    """Best-effort `bluetoothctl remove <addr>` between reconnects to clear a
    stale BlueZ device object — a half-open entry from a failed connect makes the
    next scan/connect hang. Linux/BlueZ only; silently ignored if unavailable."""
    try:
        subprocess.run(
            ["bluetoothctl", "remove", address],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
            check=False,
        )
    except Exception:  # noqa: BLE001
        pass


async def run_forever(
    address: str,
    preset: str | int,
    redis_url: str,
    channel_samples: str,
    channel_status: str,
) -> None:
    """Reconnect loop. Sleeps 3 s between attempts on failure."""
    import redis  # local import so `scan` can run without a redis-server reachable

    redis_client = redis.Redis.from_url(redis_url, socket_connect_timeout=2)
    # Eagerly publish "disconnected" so viewers don't sit on a stale state.
    _publish(
        redis_client,
        channel_status,
        {
            "t": "status",
            "ts": _now_ms(),
            "connected": False,
            "address": address,
            "note": "BRIDGE STARTING",
        },
    )

    while True:
        try:
            await stream_once(
                address=address,
                preset=preset,
                redis_client=redis_client,
                channel_samples=channel_samples,
                channel_status=channel_status,
            )
        except KeyboardInterrupt:
            print("[bridge] interrupted — bye", flush=True)
            return
        except Exception as err:  # noqa: BLE001
            print(f"[bridge] stream_once errored: {err}", flush=True)
            _publish(
                redis_client,
                channel_status,
                {
                    "t": "status",
                    "ts": _now_ms(),
                    "connected": False,
                    "address": address,
                    "note": f"ERR: {type(err).__name__}",
                },
            )

        # Clear any stale BlueZ device object so the next scan/connect doesn't hang.
        _bluetoothctl_remove(address)
        print("[bridge] sleeping 3s before reconnect ...", flush=True)
        await asyncio.sleep(3)
