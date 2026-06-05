"""EEG band-power computation via BrainFlow's DataFilter.

Why this lives in the bridge (Python) and not the browser:

The browser used to compute band powers with a hand-rolled FFT over a single
1-second window. That has two flaws — it re-runs an IIR filter from a cold start
every window (injecting transients / jitter), and it's a lot of DSP to babysit in
JS. BrainFlow is purpose-built for exactly this and runs server-side once, so the
browser just renders the result.

We deliberately emit **absolute** per-channel band powers (PSD integrated over
each band) rather than normalized/relative ones, so the UI can derive relative
%, log dB, *or* per-channel views from the same numbers without re-deriving them.

Signal chain, per channel, on a rolling ~2 s buffer:

    linear detrend  ->  0.5 Hz Butterworth high-pass  ->  mains notch  ->
    Welch PSD  ->  integrate power in each band.

If BrainFlow can't be imported (not installed), `BANDPOWER_AVAILABLE` is False and
the bridge simply skips band frames — raw EEG still streams as before.
"""

from __future__ import annotations

from typing import Optional, Sequence

try:
    import numpy as np
    from brainflow.data_filter import (
        DataFilter,
        DetrendOperations,
        FilterTypes,
        WindowOperations,
    )

    BANDPOWER_AVAILABLE = True
except Exception:  # pragma: no cover — keep the bridge usable without brainflow
    BANDPOWER_AVAILABLE = False


# (low, high) Hz for delta, theta, alpha, beta, gamma — Muse / Mind Monitor ranges.
BANDS: list[tuple[float, float]] = [
    (1.0, 4.0),
    (4.0, 8.0),
    (8.0, 13.0),
    (13.0, 30.0),
    (30.0, 44.0),
]

# Remove sub-delta drift (breathing ~0.3 Hz, sweat, slow sway) while leaving the
# delta band (1-4 Hz) intact.
HIGHPASS_HZ = 0.5

# Mains hum. 60 Hz for North America; set the env override to 50 elsewhere.
NOTCH_HZ = 60.0


def compute_band_powers(
    samples: Sequence[Sequence[float]],
    rate: int,
    notch_hz: float = NOTCH_HZ,
) -> Optional[list[list[float]]]:
    """Compute absolute per-channel band powers from a rolling EEG window.

    Args:
        samples: chronological EEG samples, each a (ch0, ch1, ch2, ch3) tuple in µV.
        rate: EEG sample rate in Hz (Muse = 256).
        notch_hz: mains frequency to notch out (60 NA / 50 elsewhere).

    Returns:
        A list of `n_channels` lists, each `[delta, theta, alpha, beta, gamma]`
        absolute power. Or None if BrainFlow is unavailable or there isn't enough
        data for a stable PSD yet.
    """
    if not BANDPOWER_AVAILABLE:
        return None

    arr = np.asarray(samples, dtype=np.float64)  # (N, channels)
    if arr.ndim != 2 or arr.shape[1] < 1:
        return None

    nfft = DataFilter.get_nearest_power_of_two(rate)
    if arr.shape[0] < nfft:  # need at least one full FFT window for Welch
        return None

    n_ch = arr.shape[1]
    eeg = np.ascontiguousarray(arr.T)  # (channels, N)
    out: list[list[float]] = []

    for ch in range(n_ch):
        data = np.ascontiguousarray(eeg[ch])  # BrainFlow mutates in place
        DataFilter.detrend(data, DetrendOperations.LINEAR.value)
        DataFilter.perform_highpass(
            data, rate, HIGHPASS_HZ, 2, FilterTypes.BUTTERWORTH.value, 0.0
        )
        # Notch the mains line (±2 Hz band-stop around it) to keep beta/gamma clean.
        DataFilter.perform_bandstop(
            data, rate, notch_hz - 2.0, notch_hz + 2.0, 2, FilterTypes.BUTTERWORTH.value, 0.0
        )
        psd = DataFilter.get_psd_welch(
            data, nfft, nfft // 2, rate, WindowOperations.HANNING.value
        )
        out.append([float(DataFilter.get_band_power(psd, lo, hi)) for (lo, hi) in BANDS])

    return out
