import { Redis } from "ioredis"

/**
 * Two ioredis clients — one publisher, one subscriber.
 *
 * ioredis requires a dedicated connection for SUBSCRIBE because the connection
 * enters "subscriber mode" and can't issue normal commands. The publisher
 * connection stays free for `PUBLISH`.
 *
 * The `onMessage` callback is invoked with the raw JSON string we received
 * from Redis (already validated as a non-empty string) — the server decides
 * how to broadcast it.
 */
export type Bus = {
  publish: (channel: string, payload: string) => Promise<number>
  close: () => Promise<void>
}

export function startBus(
  channels: string[],
  onMessage: (channel: string, payload: string) => void
): Bus {
  const url = process.env.REDIS_URL || "redis://localhost:6380"

  const opts = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      return Math.min(times * 100, 3000)
    },
    lazyConnect: false,
  }

  const publisher = new Redis(url, opts)
  const subscriber = new Redis(url, opts)

  publisher.on("error", (err) => console.error("[bd:bus] publisher error:", err.message))
  subscriber.on("error", (err) => console.error("[bd:bus] subscriber error:", err.message))
  publisher.on("ready", () => console.log("[bd:bus] publisher ready"))
  subscriber.on("ready", () => console.log("[bd:bus] subscriber ready"))

  subscriber.subscribe(...channels, (err, count) => {
    if (err) console.error("[bd:bus] subscribe error:", err.message)
    else console.log(`[bd:bus] subscribed to ${count} channel(s):`, channels.join(", "))
  })

  subscriber.on("message", (channel, message) => {
    if (typeof message !== "string" || message.length === 0) return
    onMessage(channel, message)
  })

  return {
    publish: (channel, payload) => publisher.publish(channel, payload),
    close: async () => {
      await Promise.allSettled([publisher.quit(), subscriber.quit()])
    },
  }
}
