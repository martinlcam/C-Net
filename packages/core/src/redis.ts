import { Redis } from "ioredis"

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL
  const redisHost = process.env.REDIS_HOST || "localhost"
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10)

  if (redisUrl) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError(err) {
        const targetError = "READONLY"
        if (err.message.includes(targetError)) {
          return true
        }
        return false
      },
    })
  } else {
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError(err) {
        const targetError = "READONLY"
        if (err.message.includes(targetError)) {
          return true
        }
        return false
      },
    })
  }

  redisClient.on("error", (err) => {
    console.error("Redis Client Error:", err)
  })

  redisClient.on("connect", () => {
    console.log("Redis Client Connected")
  })

  redisClient.on("ready", () => {
    console.log("Redis Client Ready")
  })

  return redisClient
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
