import { useEffect, useState } from "react"
import { type VaultFile, vaultUrl } from "@/lib/vault-api"
import {
  type Calibration,
  DEFAULT_CALIBRATION,
  findInstaOffset,
  parseInstaOffset,
} from "./panorama"

// The camera writes its lens calibration a few kilobytes before the end of every video.
const TAIL_BYTES = 16 * 1024

const cache = new Map<string, Calibration>()

/**
 * Lens calibration for a dual-fisheye file. Videos carry theirs in the trailer, read with one
 * small range request; photos bury it megabytes deep, so they use the built-in numbers. The
 * default is returned until (and unless) the real one arrives.
 */
export function useInstaCalibration(file: VaultFile | null): Calibration {
  const id = file?.id ?? null
  const [cal, setCal] = useState<Calibration>(() => (id && cache.get(id)) || DEFAULT_CALIBRATION)

  useEffect(() => {
    if (!file) return
    const cached = cache.get(file.id)
    if (cached) {
      setCal(cached)
      return
    }
    setCal(DEFAULT_CALIBRATION)
    if (!file.filename.toLowerCase().endsWith(".lrv") || file.size <= TAIL_BYTES) return

    const controller = new AbortController()
    fetch(vaultUrl(file.previewUrl), {
      headers: { Range: `bytes=${file.size - TAIL_BYTES}-${file.size - 1}` },
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => {
        // Anything but a partial response would be the whole file; don't read that.
        if (res.status !== 206) {
          res.body?.cancel().catch(() => {})
          return null
        }
        return res.arrayBuffer()
      })
      .then((buf) => {
        if (!buf) return
        const text = findInstaOffset(new Uint8Array(buf))
        const parsed = text ? parseInstaOffset(text) : null
        if (!parsed) return
        cache.set(file.id, parsed)
        setCal(parsed)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [file])

  return cal
}
