import cors, { type CorsOptions } from "cors"
import express from "express"
import { RegisterRoutes } from "./generated/routes"
import { errorHandler } from "./middleware/error.middleware"

const defaultDevOrigins = ["http://localhost:3001", "http://127.0.0.1:3001"]

function isPrivateLanDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false
  try {
    const u = new URL(origin)
    if (u.port !== "3001") return false
    if (u.protocol !== "http:" && u.protocol !== "https:") return false
    const h = u.hostname
    if (h === "localhost" || h === "127.0.0.1") return true
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true
    return false
  } catch {
    return false
  }
}

function parseAllowlist(): string[] {
  const raw = process.env.CORS_ORIGIN?.trim()
  if (!raw) return [...defaultDevOrigins]
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const corsOptions: CorsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}

function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) {
  const allowlist = parseAllowlist()
  if (!origin) {
    callback(null, true)
    return
  }
  if (allowlist.includes(origin)) {
    callback(null, true)
    return
  }
  if (isPrivateLanDevOrigin(origin)) {
    callback(null, true)
    return
  }
  callback(null, false)
}

export function createApp(): express.Express {
  const app = express()

  // CORS must run before body parsers so OPTIONS preflight gets headers reliably (Express 5 + fetch preflight).
  const isProd = process.env.NODE_ENV === "production"
  app.use(
    cors({
      ...corsOptions,
      // In dev, reflect any request Origin (avoids mismatched CORS_ORIGIN vs actual dev URL).
      origin: isProd ? corsOriginCallback : true,
    })
  )
  app.use(express.json())

  RegisterRoutes(app)

  app.use(errorHandler)

  return app
}
