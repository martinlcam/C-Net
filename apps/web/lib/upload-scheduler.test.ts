import { describe, expect, it } from "bun:test"
import { RetryableError, runWithConcurrency, withRetry } from "./upload-scheduler"

describe("runWithConcurrency", () => {
  it("never runs more than `limit` workers at once and finishes every item", async () => {
    let active = 0
    let peak = 0
    const done: number[] = []
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      done.push(n)
      active--
    })
    expect(peak).toBe(3)
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("rejects with the first error once the running workers have settled", async () => {
    let settled = 0
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (n) => {
        await new Promise((r) => setTimeout(r, 5))
        settled++
        if (n === 2) throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    expect(settled).toBeGreaterThanOrEqual(2)
  })

  it("handles an empty list", async () => {
    await runWithConcurrency([], 4, async () => {
      throw new Error("never called")
    })
  })
})

describe("withRetry", () => {
  it("retries retryable errors and returns the eventual result", async () => {
    let calls = 0
    const out = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw new RetryableError("flaky")
        return "ok"
      },
      { attempts: 5, baseMs: 1 }
    )
    expect(out).toBe("ok")
    expect(calls).toBe(3)
  })

  it("gives up after `attempts` and rethrows the last error", async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw new RetryableError("down")
        },
        { attempts: 3, baseMs: 1 }
      )
    ).rejects.toThrow("down")
    expect(calls).toBe(3)
  })

  it("does not retry non-retryable errors", async () => {
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls++
          throw new Error("bad request")
        },
        { attempts: 3, baseMs: 1 }
      )
    ).rejects.toThrow("bad request")
    expect(calls).toBe(1)
  })
})
