# @cnet/realtime

Tiny Bun WebSocket service that fans out BD (Braindance) frames from Redis
pub/sub to browser viewers.

```
[neural-bridge] --PUBLISH bd:samples--> [Redis] --SUBSCRIBE--> [this service] --WS--> [browser /bd]
```

## Environment

Reads from the root `.env` (loaded by turbo via `globalEnv`):

| Var                          | Default                  | Purpose                                 |
| ---------------------------- | ------------------------ | --------------------------------------- |
| `REALTIME_PORT`              | `4002`                   | TCP port for HTTP + WS                  |
| `REDIS_URL`                  | `redis://localhost:6380` | Same Redis the rest of C-Net uses       |
| `BD_INGEST_KEY`              | `dev-insecure-key`       | Required `?token=` for `/bd/ingest`     |
| `BD_REDIS_CHANNEL_SAMPLES`   | `bd:samples`             | Pub/sub channel for sample frames       |
| `BD_REDIS_CHANNEL_STATUS`    | `bd:status`              | Pub/sub channel for status frames       |

## Routes

| Path          | Method | Auth                 | Purpose                                         |
| ------------- | ------ | -------------------- | ----------------------------------------------- |
| `/health`     | GET    | none                 | Liveness probe                                  |
| `/bd/live`    | GET/WS | none (public viewer) | Subscribe to fan-out of `bd:samples + bd:status`|
| `/bd/ingest`  | GET/WS | `?token=...`         | Publisher (neural-bridge or fake-publisher)     |

## Local smoke test

In one shell:

```bash
bun run dev
```

In another, with [`wscat`](https://www.npmjs.com/package/wscat):

```bash
# viewer
wscat -c ws://localhost:4002/bd/live

# publisher
wscat -c "ws://localhost:4002/bd/ingest?token=$BD_INGEST_KEY"
# then paste a frame:
{"t":"status","ts":1700000000000,"connected":true,"deviceName":"Muse-TEST","battery":88}
```

Or run the bundled fake publisher (from repo root):

```bash
bun run scripts/bd-fake-publisher.ts
```
