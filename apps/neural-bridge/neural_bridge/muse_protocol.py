"""Muse 2 BLE / GATT constants and command helpers.

Sourced from muse-lsl (`muselsl/constants.py` + `muselsl/muse.py`), which is
the canonical open-source reference for the InteraXon Muse protocol. The
headband itself never publicly documented these; everything below has been
reverse-engineered and is stable across firmware versions for Muse 2 and
Muse S.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Service + characteristic UUIDs.
# Interaxon's vendor service is 0xfe8d; all our characteristics live inside
# the `273e000X-4c4d-454d-96be-f03bac821358` family.
# ---------------------------------------------------------------------------

UUID_STREAM_TOGGLE = "273e0001-4c4d-454d-96be-f03bac821358"  # write commands here

# EEG — 4 active channels on Muse 2 (we skip AUX = 0007 unless you've wired in
# an external electrode; with nothing connected it's pure noise).
UUID_EEG_TP9 = "273e0003-4c4d-454d-96be-f03bac821358"
UUID_EEG_AF7 = "273e0004-4c4d-454d-96be-f03bac821358"
UUID_EEG_AF8 = "273e0005-4c4d-454d-96be-f03bac821358"
UUID_EEG_TP10 = "273e0006-4c4d-454d-96be-f03bac821358"
UUID_EEG_AUX = "273e0007-4c4d-454d-96be-f03bac821358"

# IMU.
UUID_GYRO = "273e0009-4c4d-454d-96be-f03bac821358"
UUID_ACCELEROMETER = "273e000a-4c4d-454d-96be-f03bac821358"

# Telemetry (battery + temp + ADC volt).
UUID_TELEMETRY = "273e000b-4c4d-454d-96be-f03bac821358"

# PPG — Muse 2 / Muse S only.
UUID_PPG_AMBIENT = "273e000f-4c4d-454d-96be-f03bac821358"
UUID_PPG_INFRARED = "273e0010-4c4d-454d-96be-f03bac821358"
UUID_PPG_RED = "273e0011-4c4d-454d-96be-f03bac821358"

# Index of each EEG UUID into the (TP9, AF7, AF8, TP10) tuple emitted to the
# realtime service.
EEG_CHANNEL_INDEX: dict[str, int] = {
    UUID_EEG_TP9: 0,
    UUID_EEG_AF7: 1,
    UUID_EEG_AF8: 2,
    UUID_EEG_TP10: 3,
}

# Same for PPG (ambient, IR, red).
PPG_CHANNEL_INDEX: dict[str, int] = {
    UUID_PPG_AMBIENT: 0,
    UUID_PPG_INFRARED: 1,
    UUID_PPG_RED: 2,
}

# Native sample rates the headband emits at.
EEG_SAMPLES_PER_PACKET = 12  # 12 samples per BLE notification per channel
EEG_SAMPLE_RATE = 256  # Hz
PPG_SAMPLES_PER_PACKET = 6
PPG_SAMPLE_RATE = 64
IMU_SAMPLES_PER_PACKET = 3
IMU_SAMPLE_RATE = 52

# Scaling constants for IMU readings.
ACC_SCALE_G = 0.0000610352  # raw int16 -> g
GYRO_SCALE_DPS = 0.0074768  # raw int16 -> degrees/sec

# EEG scaling: 12-bit unsigned, centered at 2048, with 0.48828125 uV per LSB.
EEG_OFFSET = 2048
EEG_SCALE_UV = 0.48828125


def encode_command(cmd: str) -> bytes:
    """Encode a Muse control command as it expects to receive it.

    Format: `[length_byte][ascii_bytes...][0x0a]` where `length_byte` is the
    number of ASCII bytes plus the trailing newline. So `'d'` -> `b'\\x02d\\n'`,
    `'h'` -> `b'\\x02h\\n'`, `'p21'` -> `b'\\x04p21\\n'`.
    """
    payload = cmd.encode("ascii")
    return bytes([len(payload) + 1, *payload, 0x0A])


# Convenience aliases for the three commands we actually send.
CMD_HALT = encode_command("h")
CMD_RESUME = encode_command("d")
CMD_KEEPALIVE = encode_command("k")


def cmd_preset(preset: str | int) -> bytes:
    """Build the `p<preset>` command. Accepts `21`, `"21"`, or `"p21"`."""
    s = str(preset)
    if s.startswith("p"):
        s = s[1:]
    return encode_command(f"p{s}")
