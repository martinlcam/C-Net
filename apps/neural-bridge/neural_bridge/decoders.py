"""Decode raw GATT notifications from a Muse 2 into Python floats.

Each notification is a fixed 20-byte little-endian-ish blob. The decoding
formulas (especially the 12-bit-packed EEG and 24-bit-packed PPG) come
straight from muse-lsl's `_unpack_eeg_channel` / `_unpack_ppg_channel`.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

from bitstring import Bits

from . import muse_protocol as mp


@dataclass
class EegPacket:
    sequence: int
    """Headband packet counter (wraps at 0xFFFF — used for drop-detection)."""
    samples_uv: list[float]
    """12 samples in microvolts (chronological order, oldest first)."""


@dataclass
class PpgPacket:
    sequence: int
    samples_raw: list[int]
    """6 raw 24-bit samples. No standard physical unit — we ship them as-is."""


@dataclass
class ImuPacket:
    sequence: int
    samples: list[tuple[float, float, float]]
    """3 (x, y, z) tuples, already scaled to g or deg/sec."""


@dataclass
class TelemetryPacket:
    sequence: int
    battery_pct: float
    """0..100"""
    fuel_gauge: float
    adc_volt: int
    temperature: int


# ---------------------------------------------------------------------------
# EEG: 16-bit packet index + 12 * 12-bit unsigned samples = 2 + 18 = 20 bytes.
# ---------------------------------------------------------------------------

_EEG_PATTERN = (
    "uint:16,uint:12,uint:12,uint:12,uint:12,uint:12,uint:12,"
    "uint:12,uint:12,uint:12,uint:12,uint:12,uint:12"
)


def decode_eeg(data: bytes) -> EegPacket:
    fields = Bits(bytes=bytes(data)).unpack(_EEG_PATTERN)
    seq = int(fields[0])
    samples = [mp.EEG_SCALE_UV * (int(raw) - mp.EEG_OFFSET) for raw in fields[1:]]
    return EegPacket(sequence=seq, samples_uv=samples)


# ---------------------------------------------------------------------------
# PPG: 16-bit packet index + 6 * 24-bit unsigned samples = 2 + 18 = 20 bytes.
# ---------------------------------------------------------------------------

_PPG_PATTERN = "uint:16,uint:24,uint:24,uint:24,uint:24,uint:24,uint:24"


def decode_ppg(data: bytes) -> PpgPacket:
    fields = Bits(bytes=bytes(data)).unpack(_PPG_PATTERN)
    return PpgPacket(sequence=int(fields[0]), samples_raw=[int(v) for v in fields[1:]])


# ---------------------------------------------------------------------------
# IMU (ACC + GYRO share the same shape): 16-bit packet index + 9 * int16
#   = 3 samples * 3 axes. The 9 int16s are stored axis-major (x0, y0, z0,
#   x1, y1, z1, x2, y2, z2) per muse-lsl reshape(3,3, order='F').
# ---------------------------------------------------------------------------


def _decode_imu(data: bytes, scale: float) -> ImuPacket:
    raw = struct.unpack(">Hhhhhhhhhh", bytes(data))
    seq = raw[0]
    flat = raw[1:]
    # Fortran ('F') reshape from numpy: column-major. With 9 elements into
    # (3 axes, 3 samples) shape='F', flat[0]=x_s0, flat[1]=x_s1, flat[2]=x_s2,
    # flat[3]=y_s0 ... To produce a list of (x, y, z) tuples sample-by-sample:
    samples = [
        (flat[i] * scale, flat[i + 3] * scale, flat[i + 6] * scale)
        for i in range(3)
    ]
    return ImuPacket(sequence=seq, samples=samples)


def decode_acc(data: bytes) -> ImuPacket:
    return _decode_imu(data, mp.ACC_SCALE_G)


def decode_gyro(data: bytes) -> ImuPacket:
    return _decode_imu(data, mp.GYRO_SCALE_DPS)


# ---------------------------------------------------------------------------
# Telemetry: 5 * uint16. (Remaining bytes are zero-padding.)
# ---------------------------------------------------------------------------


def decode_telemetry(data: bytes) -> TelemetryPacket:
    # The packet may be padded out to 20 bytes; we only need the first 10.
    raw = struct.unpack(">HHHHH", bytes(data[:10]))
    return TelemetryPacket(
        sequence=raw[0],
        battery_pct=raw[1] / 512.0,
        fuel_gauge=raw[2] * 2.2,
        adc_volt=raw[3],
        temperature=raw[4],
    )
