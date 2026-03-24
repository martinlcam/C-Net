import cors from "cors"
import express from "express"
import { RegisterRoutes } from "./generated/routes"
import { errorHandler } from "./middleware/error.middleware"

export function createApp(): express.Express {
  const app = express()

  app.use(express.json())
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3001",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    })
  )

  RegisterRoutes(app)

  app.use(errorHandler)

  return app
}
