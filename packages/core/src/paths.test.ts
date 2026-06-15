import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { findRepoRoot, isLocalDataTankPath, resolveTankMountPath } from "./paths"

describe("paths", () => {
  it("finds the monorepo root", () => {
    const root = findRepoRoot()
    expect(existsSync(join(root, "turbo.json"))).toBe(true)
  })

  it("resolves relative tank paths from repo root", () => {
    const resolved = resolveTankMountPath(".data/tank")
    expect(resolved).toBe(join(findRepoRoot(), ".data", "tank"))
  })

  describe("isLocalDataTankPath", () => {
    let probe: string

    beforeAll(async () => {
      probe = join(findRepoRoot(), ".data", "_probe")
      await mkdir(probe, { recursive: true })
    })

    afterAll(async () => {
      await rm(probe, { recursive: true, force: true })
    })

    it("accepts paths under .data", () => {
      expect(isLocalDataTankPath(join(findRepoRoot(), ".data", "tank"))).toBe(true)
      expect(isLocalDataTankPath(probe)).toBe(true)
    })

    it("rejects paths outside .data", () => {
      expect(isLocalDataTankPath("/mnt/tank")).toBe(false)
    })
  })
})
