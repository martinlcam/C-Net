# @cnet/neural-bridge

Tiny Python service that connects to a Muse 2 EEG headband over Bluetooth Low
Energy, decodes the proprietary GATT stream, and publishes batched JSON frames
to Redis pub/sub. The `apps/realtime` Bun service subscribes and fans those
frames out to viewers of `/bd`.

```
Muse 2 --BLE--> bridge (this) --PUBLISH bd:samples--> Redis --SUBSCRIBE--> apps/realtime --WS--> browser
                                                        |
                                                        +-----> (future) ML controller
```

The bridge is intentionally **not** part of the JS monorepo: only Python has
a reliable BLE stack on Windows 11 (`bleak` -> Microsoft BTLE driver). The
Node/Bun equivalents (`noble`, `bleat`) are broken on Win11.

## Why no Windows pairing?

The Windows Settings -> "Add Bluetooth device" flow is for classic Bluetooth
(audio, keyboards) and is known to be broken for Muse on Win11. `bleak` skips
that entirely and talks GATT directly to the headband's BLE advertisement.
The headband never appears in Windows' paired-device list.

## Install (one time)

```bash
cd apps/neural-bridge
python -m venv .venv
. .venv/Scripts/activate         # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -e .
```

`bleak` ships with the WinRT bindings — no separate driver install on Win11.

## Pair (each session, first time)

1. **Fully close the Muse mobile app** (force-quit). BLE allows one client at
   a time; if your phone is connected the PC literally cannot see the device.
2. Power-cycle the headband (hold the button until LEDs flash). Then short-press
   to wake it — it'll start advertising for ~30 s.
3. From this folder:

   ```bash
   python -m neural_bridge scan
   ```

   You'll see something like:

   ```
   Scanning 10s for BLE devices nearby...
     Muse-7DDB        00:55:DA:B7:7D:DB    rssi=-58
   ```

4. Copy the address into `.env`:

   ```bash
   cp .env.example .env
   # edit .env: MUSE_ADDRESS=00:55:DA:B7:7D:DB
   ```

## Run

```bash
python -m neural_bridge run
```

You should see:

```
[bridge] connecting to 00:55:DA:B7:7D:DB ...
[bridge] connected. subscribing EEG/PPG/ACC/GYRO/TELEMETRY ...
[bridge] streaming  eeg=12 ppg=6 acc=3 gyro=3  -> bd:samples
```

Now load `/bd` in the browser — it should flip from "EEG NOT CONNECTED" to
live waveforms within a second.

## CLI reference

```bash
# 10-second scan, filter to Muse devices.
python -m neural_bridge scan
python -m neural_bridge scan --seconds 20 --all      # show every BLE device

# Run the bridge. Uses MUSE_ADDRESS from .env if --address not passed.
python -m neural_bridge run
python -m neural_bridge run --address 00:55:DA:B7:7D:DB
python -m neural_bridge run --preset 20              # alternate preset
```

## Troubleshooting

- **`scan` finds nothing:**
  - Phone Muse app still open? Force-quit.
  - Headband powered? Press power once to wake it.
  - Try `--seconds 30 --all` and look for any `Muse-*` name.
  - Last resort: update the MediaTek Bluetooth driver from the laptop OEM site
    (the 2022 in-box driver has known BLE-discovery quirks).
- **`run` connects but no samples:**
  - Check `REDIS_URL` matches what `apps/realtime` is reading from.
  - In another shell: `redis-cli -p 6380 SUBSCRIBE bd:samples`. If you see
    JSON arriving here but nothing in the browser, the issue is in `apps/realtime`.
- **Battery shows null forever:** Telemetry comes every ~10 s; give it a beat.
