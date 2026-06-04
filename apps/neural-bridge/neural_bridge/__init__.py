"""C-Net Neural Bridge — Muse 2 EEG -> Redis pub/sub.

See README.md for the full design rationale. The short version:

    Muse 2 ---BLE---> [this package] ---PUBLISH bd:samples---> Redis
                                                                 |
                                                                 v
                                          apps/realtime  --WS-->  /bd browser

This module is intentionally tiny — protocol details live in `muse_protocol`,
sample decoding in `decoders`, and the streaming loop / Redis fan-out in
`publisher`. The CLI is `python -m neural_bridge {scan|run}`.
"""

__version__ = "0.1.0"
