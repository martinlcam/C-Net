/** Thrown (or wrapped) for failures worth retrying: network errors, 5xx, 429. */
export class RetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RetryableError"
  }
}

/**
 * Run `worker` over `items` with at most `limit` in flight. Resolves when every item is
 * done; rejects with the first error once the workers already running have settled. No
 * new items start after a failure.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0
  let failed = false
  let firstError: unknown
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length && !failed) {
      const i = next++
      try {
        await worker(items[i], i)
      } catch (err) {
        if (!failed) {
          failed = true
          firstError = err
        }
      }
    }
  })
  await Promise.all(lanes)
  if (failed) throw firstError
}

/** Retry `fn` on RetryableError with exponential backoff: baseMs, 2x, 4x ... */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; baseMs: number }
): Promise<T> {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (!(err instanceof RetryableError) || attempt >= opts.attempts) throw err
      await new Promise((r) => setTimeout(r, opts.baseMs * 2 ** (attempt - 1)))
    }
  }
}
