import Redis from "ioredis"
import { Pool } from "pg"

export async function runPreflightChecks(): Promise<void> {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    await pool.query("SELECT 1")
    await pool.end()
    console.log("✅ Database connected")
  } catch {
    console.warn("⚠ Database not reachable at DATABASE_URL — API will fail on DB queries")
  }

  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
    const redis = new Redis(redisUrl)
    await redis.ping()
    await redis.quit()
    console.log("✅ Redis connected")
  } catch {
    console.warn("⚠ Redis not reachable — job queues will not function")
  }
}
